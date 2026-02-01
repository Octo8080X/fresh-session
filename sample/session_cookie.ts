import { CookieSessionStore, session } from "../../fresh-session/mod.ts";
import type { State } from "./main.ts";

// CookieSessionStore (session data stored in encrypted cookie; ~4KB limit)
const cookieSessionStore = new CookieSessionStore();

/**
 * Session middleware (cookie store)
 * Stores session data in the cookie itself
 */
export const cookieSessionMiddleware = session<State>(
  cookieSessionStore,
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
