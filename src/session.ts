// セッション管理の主要ロジック
import { mergeSessionConfig, type PartialSessionConfig, type SessionConfig } from "./config.ts";
import type { ISessionStore, SessionData } from "./types.ts";
import type { Middleware } from "@fresh/core";
import {
  deleteSessionCookie,
  getSessionIdFromCookie,
  setSessionCookie,
} from "./cookie.ts";
import { decrypt, encrypt, importKey } from "./crypto.ts";

/**
 * セッションID生成・管理ロジック
 */
export class SessionManager {
  #sessionId: string | undefined = undefined;
  #sessionData: SessionData | undefined = undefined;
  #doSessionDestroy: boolean = false;
  #doSessionRotate: boolean = false;
  #cryptoKey: CryptoKey | undefined = undefined;
  #isNew : boolean = false;

  constructor(
    private store: ISessionStore,
    private secret: string,
    private config: SessionConfig,
  ) {}

  /**
   * 暗号化キーを取得（遅延初期化）
   */
  private async getCryptoKey(): Promise<CryptoKey> {
    if (!this.#cryptoKey) {
      this.#cryptoKey = await importKey(this.secret);
    }
    return this.#cryptoKey;
  }

  /**
   * Cookie値を復号化
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
      // 復号化失敗時は新規セッションとして扱う
      return undefined;
    }
  }

  /**
   * Cookie値を暗号化
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
   * セッション破棄をリクエスト
   */
  requestDestroySession(): void {
    this.#doSessionDestroy = true;
  }

  /**
   * セッションIDローテーションをリクエスト
   */
  requestRotateSessionId(): void {
    this.#doSessionRotate = true;
  }
  isNew(): boolean {
    return this.#isNew;
  }

  /**
   * リクエスト処理前: Cookieからセッションを復元
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
   * レスポンス処理後: セッションを保存しCookieを設定
   */
  async after(response: Response): Promise<void> {
    if (!this.#sessionId) {
      return;
    }

    // セッション破棄
    if (this.#doSessionDestroy) {
      await this.store.destroy(this.#sessionId);
      deleteSessionCookie(response.headers, this.config.cookieName);
      return;
    }

    // セッションIDローテーション
    if (this.#doSessionRotate) {
      await this.store.destroy(this.#sessionId);
      const { sessionId } = await this.store.load(undefined); // 新規ID取得
      this.#sessionId = sessionId;
    }

    // セッション保存
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
    // 各リクエストごとに新しいSessionManagerインスタンスを作成
    const sessionManager = new SessionManager(store, secret, sessionConfig);
    await sessionManager.before(ctx.req);

    ctx.state.session = sessionManager.appMethods();

    const res = await ctx.next();
    await sessionManager.after(res);

    return res;
  };
}
