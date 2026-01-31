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
 * Partial session config (for input)
 */
export type PartialSessionConfig = {
  cookieName?: string;
  cookieOptions?: Partial<SessionConfig["cookieOptions"]>;
  sessionExpires?: number;
};

/**
 * Default configuration values
 */
export const defaultSessionConfig: SessionConfig = {
  cookieName: "fresh_session",
  cookieOptions: {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24, // 1 day
    domain: "",
  },
  sessionExpires: 1000 * 60 * 60 * 24, // 1 day
};

export function mergeSessionConfig(
  inputSessionConfig?: PartialSessionConfig,
): SessionConfig {
  // Merge input config with default config
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
