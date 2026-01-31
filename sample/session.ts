import { MemorySessionStore, session } from "../../fresh-session/mod.ts";
import type { State } from "./main.ts";

// Session store instance (persists while server is running)
const sessionStore = new MemorySessionStore();

/**
 * Session middleware
 * Manages sessions using MemorySessionStore
 */
export const sessionMiddleware = session<State>(
  sessionStore,
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
