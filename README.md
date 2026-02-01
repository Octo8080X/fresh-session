# Fresh Session 🍋

Dead simple cookie-based session for [Deno Fresh v2](https://fresh.deno.dev).

## Features

- 🔐 **AES-GCM 256-bit encryption** - Secure session data with encrypted cookies
- 💾 **Multiple storage backends** - Memory, Cookie, Deno KV, Redis, SQL
- ⚡ **Flash messages** - One-time messages for redirects
- 🔄 **Session rotation** - Regenerate session ID for security
- 🎯 **TypeScript first** - Full type safety

## Installation

```ts
import {
  CookieSessionStore,
  KvSessionStore,
  MemorySessionStore,
  RedisSessionStore,
  session,
  type SessionState,
  SqlSessionStore,
} from "./mod.ts";
```

## Quick Start

Sample app notes:
- `sample/session.ts` uses `MemorySessionStore`
- `sample/session_cookie.ts` shows the cookie store pattern
- `sample/session_kv.ts` shows the Deno KV store pattern
- `sample/session_redis.ts` shows the Redis store pattern

Redis sample notes:
- Uses `REDIS_HOST` and `REDIS_PORT` (defaults: `127.0.0.1:6379`)

### 1. Create a session middleware

```ts
// routes/_middleware.ts
import { App } from "@fresh/core";
import { MemorySessionStore, session, type SessionState } from "./mod.ts";

// Define your app state
interface State extends SessionState {
  // your other state properties
}

const app = new App<State>();

// Create a store instance
const store = new MemorySessionStore();

// Add session middleware
// Secret key must be at least 32 characters for AES-256
app.use(session(store, "your-secret-key-at-least-32-characters-long"));
```

### 2. Use session in your routes

```tsx ignore
// routes/index.tsx
app.get("/", (ctx) => {
  const { session } = ctx.state;

  // Get value from session
  const count = (session.get("count") as number) ?? 0;

  // Set value to session
  session.set("count", count + 1);

  // Check if session is new
  const isNew = session.isNew();

  // Get session ID
  const sessionId = session.sessionId();

  return ctx.render(<div>Visit count: {count + 1}</div>);
});
```

## Session API

```ts ignore
const { session } = ctx.state;

// Basic operations
session.get("key"); // Get a value
session.set("key", value); // Set a value
session.isNew(); // Check if session is new
session.sessionId(); // Get session ID

// Flash messages (one-time data)
session.flash.set("message", "Success!"); // Set flash data
session.flash.get("message"); // Get & consume flash data
session.flash.has("message"); // Check if flash exists

// Security
session.destroy(); // Destroy session
session.rotate(); // Rotate session ID (recommended after login)
```

## Storage Backends

### Memory Store (Development)

Simple in-memory storage. Data is lost when the server restarts.

```ts ignore
import { MemorySessionStore } from "jsr:@octo8080x/fresh-session";

const store = new MemorySessionStore();
```

### Cookie Store

Stores session data in the cookie itself. No server-side storage needed.

> ⚠️ Cookie size limit is ~4KB. Use for small session data only.

```ts ignore
import { CookieSessionStore } from "jsr:@octo8080x/fresh-session";

const store = new CookieSessionStore();
```

### Deno KV Store

Persistent storage using Deno KV. Recommended for Deno Deploy.

```ts ignore
import { KvSessionStore } from "jsr:@octo8080x/fresh-session";

const kv = await Deno.openKv();
const store = new KvSessionStore({ kv, keyPrefix: ["my_sessions"] });
```

### Redis Store

For distributed environments with Redis.

```ts ignore
import { type RedisClient, RedisSessionStore } from "./mod.ts";
import { connect } from "jsr:@db/redis";

const redis = await connect({
  hostname: "127.0.0.1",
  port: 6379,
});

// Adapt to RedisClient interface
const client: RedisClient = {
  get: (key) => redis.get(key),
  set: (key, value, options) =>
    redis.set(key, value, options?.ex ? { ex: options.ex } : undefined),
  del: (key) => redis.del(key),
};

const store = new RedisSessionStore({ client, keyPrefix: "session:" });
```

### SQL Store (MySQL, PostgreSQL, etc.)

For applications using relational databases.

```sql
-- Required table structure
CREATE TABLE sessions (
  session_id VARCHAR(36) PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at DATETIME NULL
);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

```ts ignore
import { type SqlClient, SqlSessionStore } from "jsr:@octo8080x/fresh-session";

// Adapt your SQL client to SqlClient interface
const client: SqlClient = {
  execute: async (sql, params) => {
    const result = await yourDbClient.query(sql, params);
    return { rows: result.rows };
  },
};

const store = new SqlSessionStore({ client, tableName: "sessions" });
```

## Configuration Options

```ts ignore
app.use(session(store, secret, {
  // Cookie name
  cookieName: "fresh_session", // default

  // Cookie options
  cookieOptions: {
    path: "/",
    httpOnly: true,
    secure: true, // Set to false for local development
    sameSite: "Lax", // "Strict" | "Lax" | "None"
    maxAge: 60 * 60 * 24, // 1 day in seconds
    domain: "",
  },

  // Session expiration in milliseconds
  sessionExpires: 1000 * 60 * 60 * 24, // 1 day (default)
}));
```

## Flash Messages

Flash messages are one-time data that get cleared after being read. Perfect for
success/error messages after redirects.

```tsx ignore
// In your form handler
app.post("/login", async (ctx) => {
  const form = await ctx.req.formData();
  // ... validate login

  if (success) {
    ctx.state.session.flash.set("message", "Login successful!");
    ctx.state.session.flash.set("type", "success");
  } else {
    ctx.state.session.flash.set("message", "Invalid credentials");
    ctx.state.session.flash.set("type", "error");
  }

  return new Response(null, {
    status: 302,
    headers: { Location: "/" },
  });
});

// In your page
app.get("/", (ctx) => {
  const message = ctx.state.session.flash.get("message"); // Read & clear
  const type = ctx.state.session.flash.get("type");

  // message is now cleared and won't appear on next request
  return ctx.render(
    <div>{message && <Alert type={type}>{message}</Alert>}</div>,
  );
});
```

## Session Rotation

Regenerate session ID while keeping session data. Recommended after
authentication to prevent session fixation attacks.

```ts ignore
app.post("/login", async (ctx) => {
  // ... validate credentials

  if (authenticated) {
    // Rotate session ID for security
    ctx.state.session.rotate();
    ctx.state.session.set("userId", user.id);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: "/dashboard" },
  });
});
```

## FAQ & Troubleshooting

### "TypeError: Headers are immutable."

This occurs when using `Response.redirect()`. Use this workaround instead:

```ts ignore
// ❌ Don't use Response.redirect()
return Response.redirect("/dashboard");

// ✅ Use this instead
return new Response(null, {
  status: 302,
  headers: { Location: "/dashboard" },
});
```

### Session not persisting

1. Make sure your secret key is at least 32 characters
2. Check that `secure: false` is set for local development (non-HTTPS)
3. Verify the session middleware is added before your routes

### Double counting visits

Browser DevTools can cause extra requests (e.g., `/.well-known/`). Add a filter
for these:

```ts ignore
app.all("/.well-known/*", () => {
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

## License

MIT

## Credits

- Initial work by [@xstevenyung](https://github.com/xstevenyung)
- Inspiration from [Oak Sessions](https://github.com/jcs224/oak_sessions)
