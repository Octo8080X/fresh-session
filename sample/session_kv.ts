import { KvSessionStore, session } from "@octo8080x/fresh-session";
import type { State } from "./main.ts";

// KvSessionStore (persistent storage via Deno KV)
const kvSessionStore = new KvSessionStore();

/**
 * Session middleware (KV store)
 * Stores session data in Deno KV
 */
export const kvSessionMiddleware = session<State>(
  kvSessionStore,
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
