/// <reference lib="deno.unstable" />
// Deno KV ストレージ実装
import type { ISessionStore, LoadResult, SessionData } from "../types.ts";

/**
 * Deno KVベースのセッションストアOptions
 */
export interface KvSessionStoreOptions {
  /**
   * KVインスタンス（省略時はDeno.openKv()で取得）
   */
  kv?: Deno.Kv;
  /**
   * KVキーのプレフィックス
   * @default ["sessions"]
   */
  keyPrefix?: Deno.KvKey;
}

/**
 * Deno KVベースのセッションストア
 * 永続的なセッション管理が可能
 */
export class KvSessionStore implements ISessionStore {
  #kv: Deno.Kv | undefined;
  #kvPromise: Promise<Deno.Kv> | undefined;
  #keyPrefix: Deno.KvKey;

  constructor(options: KvSessionStoreOptions = {}) {
    this.#kv = options.kv;
    this.#keyPrefix = options.keyPrefix ?? ["sessions"];
  }

  cleanup?(): void {
    throw new Error("Method not implemented.");
  }

  /**
   * KVインスタンスを取得（遅延初期化）
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
   * セッションIDからKVキーを生成
   */
  private getKey(sessionId: string): Deno.KvKey {
    return [...this.#keyPrefix, sessionId];
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

    // 有効期限チェック
    if (entry.value.expiresAt && new Date(entry.value.expiresAt) < new Date()) {
      // 期限切れの場合は削除
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
   * セッションを保存し、Cookieに設定する値（セッションID）を返す
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

    // expireInオプションを使用してKVレベルでも自動期限切れを設定
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
   * セッションを破棄
   */
  async destroy(sessionId: string): Promise<void> {
    const kv = await this.getKv();
    await kv.delete(this.getKey(sessionId));
  }

  /**
   * KV接続を閉じる
   */
  async close(): Promise<void> {
    if (this.#kv) {
      await this.#kv.close();
      this.#kv = undefined;
      this.#kvPromise = undefined;
    }
  }
}
