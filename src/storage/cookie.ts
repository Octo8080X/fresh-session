// Cookieストレージ実装
// セッションデータをCookie自体に保存（暗号化はsession.tsで行う）
import type { ISessionStore, LoadResult, SessionData } from "../types.ts";

/**
 * Cookieベースのセッションストア
 * セッションデータをCookie自体に保存
 * サーバー側にストレージ不要だが、Cookieサイズ制限（4KB）に注意
 * 暗号化・復号化はSessionManagerが行う
 */
export class CookieSessionStore implements ISessionStore {
  /**
   * Cookieの値からセッションを復元
   * cookieValueは復号済みのJSON文字列
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

      // 有効期限チェック
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
      // パース失敗時は新規セッション
      return Promise.resolve({
        sessionId: crypto.randomUUID(),
        data: {},
        isNew: true,
      });
    }
  }

  /**
   * セッションを保存し、Cookieに設定する値（JSON文字列）を返す
   * 暗号化はSessionManagerが行う
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
   * セッションを破棄
   * CookieStoreの場合、サーバー側で何もする必要はない
   * Cookie削除はSessionManagerが行う
   */
  destroy(_sessionId: string): Promise<void> {
    return Promise.resolve();
  }
}
