// Memory storage implementation
import type { ISessionStore, LoadResult, SessionData } from "../types.ts";

/**
 * Simple in-memory session store
 */
export class MemorySessionStore implements ISessionStore {
  private store = new Map<string, { data: SessionData; expiresAt?: Date }>();

  /**
   * Restore session from cookie value (session ID)
   */
  load(cookieValue: string | undefined): Promise<LoadResult> {
    if (!cookieValue) {
      return Promise.resolve({
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      });
    }
    // If cookieValue exists and is in the store
    if (!this.store.has(cookieValue)) {
      return Promise.resolve({
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      });
    }

    const entry = this.store.get(cookieValue)!;
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      // Delete if expired
      this.store.delete(cookieValue);
      return Promise.resolve({
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      });
    }

    return Promise.resolve({
      sessionId: cookieValue,
      data: entry.data,
      isNew: false,
    });
  }

  /**
   * Save session and return value to set in cookie (session ID)
   */
  save(
    sessionId: string,
    data: SessionData,
    expiresAt?: Date,
  ): Promise<string> {
    this.store.set(sessionId, { data, expiresAt });
    return Promise.resolve(sessionId);
  }

  /**
   * Destroy session
   */
  destroy(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
    return Promise.resolve();
  }

  /**
   * Cleanup expired sessions
   */
  cleanup(): void {
    const now = new Date();
    for (const [sid, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(sid);
      }
    }
  }
}
