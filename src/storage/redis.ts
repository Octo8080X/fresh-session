// Redis storage implementation
import type { ISessionStore, LoadResult, SessionData } from "../types.ts";

/**
 * Redis connection interface
 * Abstraction for compatibility with various Redis clients
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * Redis session store options
 */
export interface RedisSessionStoreOptions {
  /**
   * Redis client instance
   */
  client: RedisClient;
  /**
   * Key prefix
   * @default "session:"
   */
  keyPrefix?: string;
}

/**
 * Redis-based session store
 * Enables persistent session management in distributed environments
 */
export class RedisSessionStore implements ISessionStore {
  #client: RedisClient;
  #keyPrefix: string;

  constructor(options: RedisSessionStoreOptions) {
    this.#client = options.client;
    this.#keyPrefix = options.keyPrefix ?? "session:";
  }

  /**
   * Generate Redis key from session ID
   */
  private getKey(sessionId: string): string {
    return `${this.#keyPrefix}${sessionId}`;
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
      const value = await this.#client.get(this.getKey(cookieValue));

      if (!value) {
        return {
          sessionId: crypto.randomUUID(),
          data: {},
          isNew: true,
        };
      }

      const parsed = JSON.parse(value) as {
        data: SessionData;
        expiresAt?: string;
      };

      // Expiry check (check at app level in addition to Redis TTL)
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        await this.#client.del(this.getKey(cookieValue));
        return {
          sessionId: crypto.randomUUID(),
          data: {},
          isNew: true,
        };
      }

      return {
        sessionId: cookieValue,
        data: parsed.data,
        isNew: false,
      };
    } catch {
      // Return new session on parse failure
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
    const value = {
      data,
      expiresAt: expiresAt?.toISOString(),
    };

    const options: { ex?: number } = {};
    if (expiresAt) {
      const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        options.ex = ttl;
      }
    }

    await this.#client.set(
      this.getKey(sessionId),
      JSON.stringify(value),
      options,
    );
    return sessionId;
  }

  /**
   * Destroy session
   */
  async destroy(sessionId: string): Promise<void> {
    await this.#client.del(this.getKey(sessionId));
  }
}
