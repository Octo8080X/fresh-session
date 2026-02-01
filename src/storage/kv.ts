// Deno KV storage implementation
import type { ISessionStore, LoadResult, SessionData } from "../types.ts";

/**
 * Deno KV session store options
 */
export interface KvSessionStoreOptions {
  /**
   * KV instance (if omitted, obtained via Deno.openKv())
   */
  kv?: Deno.Kv;
  /**
   * KV key prefix
   * @default ["sessions"]
   */
  keyPrefix?: Deno.KvKey;
}

/**
 * Deno KV-based session store
 * Enables persistent session management
 */
export class KvSessionStore implements ISessionStore {
  #kv: Deno.Kv | undefined;
  #kvPromise: Promise<Deno.Kv> | undefined;
  #keyPrefix: Deno.KvKey;

  constructor(options: KvSessionStoreOptions = {}) {
    this.#kv = options.kv;
    this.#keyPrefix = options.keyPrefix ?? ["sessions"];
  }

  // Note: cleanup() is not implemented for KvSessionStore
  // Deno KV handles expiration automatically via expireIn option

  /**
   * Get KV instance (lazy initialization)
   */
  private async getKv(): Promise<Deno.Kv> {
    if (this.#kv) {
      return this.#kv;
    }
    if (!this.#kvPromise) {
      this.#kvPromise = Deno.openKv();
    }
    this.#kv = await this.#kvPromise;
    return this.#kv;
  }

  /**
   * Generate KV key from session ID
   */
  private getKey(sessionId: string): Deno.KvKey {
    return [...this.#keyPrefix, sessionId];
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

    const kv = await this.getKv();
    const entry = await kv.get<{ data: SessionData; expiresAt?: string }>(
      this.getKey(cookieValue),
    );

    if (!entry.value) {
      return {
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      };
    }

    // Expiry check
    if (entry.value.expiresAt && new Date(entry.value.expiresAt) < new Date()) {
      // Delete if expired
      await kv.delete(this.getKey(cookieValue));
      return {
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      };
    }

    return {
      sessionId: cookieValue,
      data: entry.value.data,
      isNew: false,
    };
  }

  /**
   * Save session and return value to set in cookie (session ID)
   */
  async save(
    sessionId: string,
    data: SessionData,
    expiresAt?: Date,
  ): Promise<string> {
    const kv = await this.getKv();
    const value = {
      data,
      expiresAt: expiresAt?.toISOString(),
    };

    // Use expireIn option to set auto-expiry at KV level
    const options: { expireIn?: number } = {};
    if (expiresAt) {
      const expireIn = expiresAt.getTime() - Date.now();
      if (expireIn > 0) {
        options.expireIn = expireIn;
      }
    }

    await kv.set(this.getKey(sessionId), value, options);
    return sessionId;
  }

  /**
   * Destroy session
   */
  async destroy(sessionId: string): Promise<void> {
    const kv = await this.getKv();
    await kv.delete(this.getKey(sessionId));
  }

  /**
   * Close KV connection
   */
  async close(): Promise<void> {
    if (this.#kv) {
      await this.#kv.close();
      this.#kv = undefined;
      this.#kvPromise = undefined;
    }
  }
}
