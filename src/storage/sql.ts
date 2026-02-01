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
   * SQL dialect
   * @default "mysql"
   */
  dialect?: "mysql" | "postgres";
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
 *   expires_at DATETIME NULL
 * );
 * CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
 * ```
 */
export class SqlSessionStore implements ISessionStore {
  #client: SqlClient;
  #tableName: string;
  #dialect: "mysql" | "postgres";

  constructor(options: SqlSessionStoreOptions) {
    this.#client = options.client;
    this.#tableName = options.tableName ?? "sessions";
    this.#dialect = options.dialect ?? "mysql";
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
      const selectPlaceholder = this.#dialect === "postgres" ? "$1" : "?";
      const result = await this.#client.execute(
        `SELECT data, expires_at FROM ${this.#tableName} WHERE session_id = ${selectPlaceholder}`,
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
        const rawExpires = row.expires_at instanceof Date
          ? row.expires_at
          : typeof row.expires_at === "string"
          ? row.expires_at
          : row.expires_at instanceof Uint8Array
          ? new TextDecoder().decode(row.expires_at)
          : String(row.expires_at);

        const expiresAt = rawExpires instanceof Date
          ? new Date(Date.UTC(
            rawExpires.getFullYear(),
            rawExpires.getMonth(),
            rawExpires.getDate(),
            rawExpires.getHours(),
            rawExpires.getMinutes(),
            rawExpires.getSeconds(),
            rawExpires.getMilliseconds(),
          ))
          : (() => {
            const normalized = rawExpires.replace(" ", "T");
            const hasZone = /Z|[+-]\d{2}:?\d{2}$/.test(normalized);
            const isoValue = hasZone ? normalized : `${normalized}Z`;
            return new Date(isoValue);
          })();
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

      const rawData = row.data;
      const dataText = typeof rawData === "string"
        ? rawData
        : rawData instanceof Uint8Array
        ? new TextDecoder().decode(rawData)
        : String(rawData);
      const data = JSON.parse(dataText) as SessionData;

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

    if (this.#dialect === "postgres") {
      await this.#client.execute(
        `INSERT INTO ${this.#tableName} (session_id, data, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_id)
         DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at`,
        [sessionId, dataJson, expiresAtStr],
      );
    } else {
      // UPSERT (INSERT ... ON DUPLICATE KEY UPDATE)
      await this.#client.execute(
        `INSERT INTO ${this.#tableName} (session_id, data, expires_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)`,
        [sessionId, dataJson, expiresAtStr],
      );
    }

    return sessionId;
  }

  /**
   * Destroy session
   */
  async destroy(sessionId: string): Promise<void> {
    const deletePlaceholder = this.#dialect === "postgres" ? "$1" : "?";
    await this.#client.execute(
      `DELETE FROM ${this.#tableName} WHERE session_id = ${deletePlaceholder}`,
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
