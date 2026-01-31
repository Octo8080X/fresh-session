// セッション管理プラグイン共通型定義

// セッションのデータは、任意のオブジェクト、文字列、数値、真偽値を許容
export type SessionData =
  | Record<string, unknown>
  | string
  | number
  | boolean
  | Date
  | null;

/**
 * ストレージからの読み込み結果
 */
export interface LoadResult {
  sessionId: string;
  data: SessionData;
  isNew: boolean;
}

export interface ISessionStore {
  /**
   * Cookieの値からセッションを復元
   * @param cookieValue Cookieから取得した値（セッションIDまたは暗号化データ）
   * @returns セッションID、データ、新規かどうか
   */
  load(cookieValue: string | undefined): Promise<LoadResult>;

  /**
   * セッションを保存し、Cookieに設定する値を返す
   * @returns Cookieに設定する値（メモリ: sessionId, Cookie: 暗号化データ）
   */
  save(sessionId: string, data: SessionData): Promise<string>;

  /**
   * セッションを破棄
   */
  destroy(sessionId: string): Promise<void>;

  /**
   * 有効期限切れセッションのクリーンアップ（オプション）
   */
  cleanup?(): void;
}
