// Cookie storage implementation
// Session data is stored in the cookie itself (encryption is done by session.ts)
import type { ISessionStore, LoadResult, SessionData } from "../types.ts";

/**
 * Cookie-based session store
 * Stores session data in the cookie itself
 * No server-side storage needed, but be aware of cookie size limit (4KB)
 * Encryption/decryption is handled by SessionManager
 */
export class CookieSessionStore implements ISessionStore {
  /**
   * Restore session from cookie value
   * cookieValue is a decrypted JSON string
   */
  load(cookieValue: string | undefined): Promise<LoadResult> {
    if (!cookieValue) {
      return Promise.resolve({
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      });
    }

    try {
      const parsed = JSON.parse(cookieValue) as {
        sessionId: string;
        data: SessionData;
        expiresAt?: string;
      };

      // Expiry check
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        return Promise.resolve({
          sessionId: crypto.randomUUID(),
          data: {},
          isNew: true,
        });
      }

      return Promise.resolve({
        sessionId: parsed.sessionId,
        data: parsed.data,
        isNew: false,
      });
    } catch {
      // Return new session on parse failure
      return Promise.resolve({
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      });
    }
  }

  /**
   * Save session and return value to set in cookie (JSON string)
   * Encryption is handled by SessionManager
   */
  save(
    sessionId: string,
    data: SessionData,
    expiresAt?: Date,
  ): Promise<string> {
    const payload = {
      sessionId,
      data,
      expiresAt: expiresAt?.toISOString(),
    };
    return Promise.resolve(JSON.stringify(payload));
  }

  /**
   * Destroy session
   * For CookieStore, nothing needs to be done on server side
   * Cookie deletion is handled by SessionManager
   */
  destroy(_sessionId: string): Promise<void> {
    return Promise.resolve();
  }
}
