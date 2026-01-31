// Session management main logic
import {
  mergeSessionConfig,
  type PartialSessionConfig,
  type SessionConfig,
} from "./config.ts";
import type { ISessionStore, SessionData } from "./types.ts";
import type { Middleware } from "@fresh/core";
import {
  deleteSessionCookie,
  getSessionIdFromCookie,
  setSessionCookie,
} from "./cookie.ts";
import { decrypt, encrypt, importKey } from "./crypto.ts";

/**
 * Session ID generation and management logic
 */
export class SessionManager {
  #sessionId: string | undefined = undefined;
  #sessionData: SessionData | undefined = undefined;
  #doSessionDestroy: boolean = false;
  #doSessionRotate: boolean = false;
  #cryptoKey: CryptoKey | undefined = undefined;
  #isNew: boolean = false;

  constructor(
    private store: ISessionStore,
    private secret: string,
    private config: SessionConfig,
  ) {}

  /**
   * Get encryption key (lazy initialization)
   */
  private async getCryptoKey(): Promise<CryptoKey> {
    if (!this.#cryptoKey) {
      this.#cryptoKey = await importKey(this.secret);
    }
    return this.#cryptoKey;
  }

  /**
   * Decrypt cookie value
   */
  private async decryptCookieValue(
    encryptedValue: string | undefined,
  ): Promise<string | undefined> {
    if (!encryptedValue) {
      return undefined;
    }
    try {
      const key = await this.getCryptoKey();
      return await decrypt(encryptedValue, key);
    } catch {
      // Treat as new session if decryption fails
      return undefined;
    }
  }

  /**
   * Encrypt cookie value
   */
  private async encryptCookieValue(value: string): Promise<string> {
    const key = await this.getCryptoKey();
    return await encrypt(value, key);
  }

  getValue(
    key: string,
  ): undefined | number | string | boolean | Date | Record<string, unknown> {
    if (
      this.#sessionData && typeof this.#sessionData === "object" &&
      !(this.#sessionData instanceof Date)
    ) {
      return (this.#sessionData as Record<string, unknown>)[key] as
        | undefined
        | number
        | string
        | boolean
        | Date
        | Record<string, unknown>;
    }
    return undefined;
  }

  setValue(key: string, value: SessionData): void {
    if (
      !this.#sessionData || typeof this.#sessionData !== "object" ||
      this.#sessionData instanceof Date
    ) {
      this.#sessionData = {};
    }
    (this.#sessionData as Record<string, SessionData>)[key] = value;
  }

  /**
   * Request session destruction
   */
  requestDestroySession(): void {
    this.#doSessionDestroy = true;
  }

  /**
   * Request session ID rotation
   */
  requestRotateSessionId(): void {
    this.#doSessionRotate = true;
  }
  isNew(): boolean {
    return this.#isNew;
  }

  /**
   * Before request processing: Restore session from cookie
   */
  async before(request: Request): Promise<void> {
    const encryptedCookieValue = getSessionIdFromCookie(
      request.headers,
      this.config.cookieName,
    );
    const cookieValue = await this.decryptCookieValue(encryptedCookieValue);
    const { sessionId, data, isNew } = await this.store.load(cookieValue);

    this.#sessionId = sessionId;
    this.#sessionData = data;
    this.#isNew = isNew;
  }

  /**
   * After response processing: Save session and set cookie
   */
  async after(response: Response): Promise<void> {
    if (!this.#sessionId) {
      return;
    }

    // Session destruction
    if (this.#doSessionDestroy) {
      await this.store.destroy(this.#sessionId);
      deleteSessionCookie(response.headers, this.config.cookieName);
      return;
    }

    // Session ID rotation
    if (this.#doSessionRotate) {
      await this.store.destroy(this.#sessionId);
      const { sessionId } = await this.store.load(undefined); // Get new ID
      this.#sessionId = sessionId;
    }

    // Save session
    const cookieValue = await this.store.save(
      this.#sessionId,
      this.#sessionData ?? {},
    );
    const encryptedCookieValue = await this.encryptCookieValue(cookieValue);
    setSessionCookie(
      response.headers,
      this.config.cookieName,
      encryptedCookieValue,
      this.config.cookieOptions,
    );
  }

  appMethods(): {
    get: (
      key: string,
    ) => undefined | number | string | boolean | Date | Record<string, unknown>;
    set: (key: string, value: SessionData) => void;
    destroy: () => void;
    rotate: () => void;
    isNew: () => boolean;
  } {
    return {
      get: (key: string) => this.getValue(key),
      set: (key: string, value: SessionData) => this.setValue(key, value),
      destroy: () => this.requestDestroySession(),
      rotate: () => this.requestRotateSessionId(),
      isNew: () => this.isNew(),
    };
  }
}

export interface SessionState {
  session: {
    get: (
      key: string,
    ) => undefined | number | string | boolean | Date | Record<string, unknown>;
    set: (key: string, value: SessionData) => void;
    destroy: () => void;
    rotate: () => void;
    isNew: () => boolean;
  };
}

export function session<State extends SessionState>(
  store: ISessionStore,
  secret: string,
  config?: PartialSessionConfig,
): Middleware<State> {
  const sessionConfig = mergeSessionConfig(config);
  return async (ctx) => {
    // Create new SessionManager instance for each request
    const sessionManager = new SessionManager(store, secret, sessionConfig);
    await sessionManager.before(ctx.req);

    ctx.state.session = sessionManager.appMethods();

    const res = await ctx.next();
    await sessionManager.after(res);

    return res;
  };
}
