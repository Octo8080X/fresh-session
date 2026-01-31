// Redis ストレージ実装
import type { ISessionStore, LoadResult, SessionData } from "../types.ts";

/**
 * Redis接続インターフェース
 * 様々なRedisクライアントと互換性を持たせるための抽象化
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * RedisセッションストアOptions
 */
export interface RedisSessionStoreOptions {
  /**
   * Redisクライアントインスタンス
   */
  client: RedisClient;
  /**
   * キーのプレフィックス
   * @default "session:"
   */
  keyPrefix?: string;
}

/**
 * Redisベースのセッションストア
 * 分散環境での永続的なセッション管理が可能
 */
export class RedisSessionStore implements ISessionStore {
  #client: RedisClient;
  #keyPrefix: string;

  constructor(options: RedisSessionStoreOptions) {
    this.#client = options.client;
    this.#keyPrefix = options.keyPrefix ?? "session:";
  }

  /**
   * セッションIDからRedisキーを生成
   */
  private getKey(sessionId: string): string {
    return `${this.#keyPrefix}${sessionId}`;
  }

  /**
   * Cookieの値（セッションID）からセッションを復元
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

      // 有効期限チェック（Redis TTLに加えてアプリレベルでもチェック）
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
      // パース失敗時は新規セッション
      return {
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      };
    }
  }

  /**
   * セッションを保存し、Cookieに設定する値（セッションID）を返す
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
   * セッションを破棄
   */
  async destroy(sessionId: string): Promise<void> {
    await this.#client.del(this.getKey(sessionId));
  }
}
