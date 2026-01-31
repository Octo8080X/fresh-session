export interface SessionConfig {
  cookieName: string;
  cookieOptions: {
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
    maxAge: number;
    domain: string;
  };
  sessionExpires: number; // ms
}

/**
 * 部分的なセッション設定（入力用）
 */
export type PartialSessionConfig = {
  cookieName?: string;
  cookieOptions?: Partial<SessionConfig["cookieOptions"]>;
  sessionExpires?: number;
};

/**
 * デフォルト設定値
 */
export const defaultSessionConfig: SessionConfig = {
  cookieName: "fresh_session",
  cookieOptions: {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24, // 1日
    domain: "",
  },
  sessionExpires: 1000 * 60 * 60 * 24, // 1日
};

export function mergeSessionConfig(
  inputSessionConfig?: PartialSessionConfig,
): SessionConfig {
  // デフォルト設定に入力設定をマージ
  if (!inputSessionConfig) {
    return { ...defaultSessionConfig };
  }

  return {
    cookieName: inputSessionConfig.cookieName ??
      defaultSessionConfig.cookieName,
    cookieOptions: {
      ...defaultSessionConfig.cookieOptions,
      ...inputSessionConfig.cookieOptions,
    },
    sessionExpires: inputSessionConfig.sessionExpires ??
      defaultSessionConfig.sessionExpires,
  };
}
