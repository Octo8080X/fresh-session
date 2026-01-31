// Session management plugin common type definitions

// Session data can be any object, string, number, boolean, Date, or null
export type SessionData =
  | Record<string, unknown>
  | string
  | number
  | boolean
  | Date
  | null;

/**
 * Result from loading session from storage
 */
export interface LoadResult {
  sessionId: string;
  data: SessionData;
  isNew: boolean;
}

export interface ISessionStore {
  /**
   * Restore session from cookie value
   * @param cookieValue Value from cookie (session ID or encrypted data)
   * @returns Session ID, data, and whether it's a new session
   */
  load(cookieValue: string | undefined): Promise<LoadResult>;

  /**
   * Save session and return value to set in cookie
   * @returns Value to set in cookie (memory: sessionId, cookie: encrypted data)
   */
  save(sessionId: string, data: SessionData): Promise<string>;

  /**
   * Destroy session
   */
  destroy(sessionId: string): Promise<void>;

  /**
   * Cleanup expired sessions (optional)
   */
  cleanup?(): void;
}
