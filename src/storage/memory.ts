// メモリストレージ実装
import type { ISessionStore, LoadResult, SessionData } from "../types.ts";

/**
 * シンプルなメモリ内セッションストア
 */
export class MemorySessionStore implements ISessionStore {
  private store = new Map<string, { data: SessionData; expiresAt?: Date }>();

  /**
   * Cookieの値（セッションID）からセッションを復元
   */
  load(cookieValue: string | undefined): Promise<LoadResult> {
    if (!cookieValue) {
      return Promise.resolve({
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      });
    }
    // cookieValueがあり、ストアに存在する場合
    if (!this.store.has(cookieValue)) {
      return Promise.resolve({
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      });
    }

    const entry = this.store.get(cookieValue)!;
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      // 期限切れの場合は削除
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
   * セッションを保存し、Cookieに設定する値（セッションID）を返す
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
   * セッションを破棄
   */
  destroy(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
    return Promise.resolve();
  }

  /**
   * 有効期限切れセッションのクリーンアップ
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
