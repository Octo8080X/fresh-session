// SQL storage implementation
import type { ISessionStore, LoadResult, SessionData } from "../types.ts";

/**
 * SQL connection interface
 * Abstraction for compatibility with various SQL clients
 */
export interface SqlClient {
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows?: Record<string, unknown>[] }>;
}

/**
 * SQL session store options
 */
export interface SqlSessionStoreOptions {
  /**
   * SQL client instance
   */
  client: SqlClient;
  /**
   * Table name
   * @default "sessions"
   */
  tableName?: string;
}

/**
 * SQL-based session store
 * Enables persistent session management with RDBMS
 *
 * Required table structure:
 * ```sql
 * CREATE TABLE sessions (
 *   session_id VARCHAR(36) PRIMARY KEY,
 *   data TEXT NOT NULL,
 *   expires_at DATETIME NULL,
 *   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 *   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 * );
 * CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
 * ```
 */
export class SqlSessionStore implements ISessionStore {
  #client: SqlClient;
  #tableName: string;

  constructor(options: SqlSessionStoreOptions) {
    this.#client = options.client;
    this.#tableName = options.tableName ?? "sessions";
  }

  /**
   * Restore session from cookie value (session ID)
   */
  async load(cookieValue: string | undefined): Promise<LoadResult> {
    if (!cookieValue) {
      return {
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      };
    }

    try {
      const result = await this.#client.execute(
        `SELECT data, expires_at FROM ${this.#tableName} WHERE session_id = ?`,
        [cookieValue],
      );

      if (!result.rows || result.rows.length === 0) {
        return {
          sessionId: crypto.randomUUID(),
          data: {},
          isNew: true,
        };
      }

      const row = result.rows[0];

      // Expiry check
      if (row.expires_at) {
        const expiresAt = new Date(row.expires_at as string);
        if (expiresAt < new Date()) {
          // Delete if expired
          await this.destroy(cookieValue);
          return {
            sessionId: crypto.randomUUID(),
            data: {},
            isNew: true,
          };
        }
      }

      const data = JSON.parse(row.data as string) as SessionData;

      return {
        sessionId: cookieValue,
        data,
        isNew: false,
      };
    } catch {
      // Return new session on error
      return {
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      };
    }
  }

  /**
   * Save session and return value to set in cookie (session ID)
   */
  async save(
    sessionId: string,
    data: SessionData,
    expiresAt?: Date,
  ): Promise<string> {
    const dataJson = JSON.stringify(data);
    const expiresAtStr =
      expiresAt?.toISOString().slice(0, 19).replace("T", " ") ?? null;

    // UPSERT (INSERT ... ON DUPLICATE KEY UPDATE)
    await this.#client.execute(
      `INSERT INTO ${this.#tableName} (session_id, data, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)`,
      [sessionId, dataJson, expiresAtStr],
    );

    return sessionId;
  }

  /**
   * Destroy session
   */
  async destroy(sessionId: string): Promise<void> {
    await this.#client.execute(
      `DELETE FROM ${this.#tableName} WHERE session_id = ?`,
      [sessionId],
    );
  }

  /**
   * Cleanup expired sessions
   */
  async cleanup(): Promise<void> {
    await this.#client.execute(
      `DELETE FROM ${this.#tableName} WHERE expires_at IS NOT NULL AND expires_at < NOW()`,
    );
  }
}
