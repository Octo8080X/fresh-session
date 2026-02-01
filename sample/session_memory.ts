import { MemorySessionStore, session } from "@octo8080x/fresh-session";
import type { State } from "./main.ts";

// MemorySessionStore (data lives in memory while server is running)
const memorySessionStore = new MemorySessionStore();

/**
 * Session middleware
 * Manages sessions using MemorySessionStore
 */
export const memorySessionMiddleware = session<State>(
  memorySessionStore,
  "your-secret-key-at-least-32-characters-long", // In production, get from environment variable
  {
    cookieName: "session",
    cookieOptions: {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    },
  },
);
