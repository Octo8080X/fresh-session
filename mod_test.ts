import { App } from "@fresh/core";
import { assertEquals } from "@std/assert";
import {
  CookieSessionStore,
  KvSessionStore,
  MemorySessionStore,
  RedisSessionStore,
  session,
  type SessionState,
  SqlSessionStore,
} from "./mod.ts";
import { createRedisClient } from "./src/storage/redis_test.ts";
import mysql from "mysql2/promise";

type State = Record<PropertyKey, never> & SessionState;

function extractSessionCookie(
  response: Response,
  cookieName = "fresh_session",
): string | null {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return null;

  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

// Test secret key (32+ characters required)
const TEST_SECRET = "this-is-a-test-secret-key-32chars!";

const MYSQL_HOST = Deno.env.get("MYSQL_HOST") ?? "127.0.0.1";
const MYSQL_PORT = Number(Deno.env.get("MYSQL_PORT") ?? "3307");
const MYSQL_USER = Deno.env.get("MYSQL_USER") ?? "root";
const MYSQL_PASSWORD = Deno.env.get("MYSQL_PASSWORD") ?? "root";
const MYSQL_DATABASE = Deno.env.get("MYSQL_DATABASE") ?? "fresh_session";
const MYSQL_TABLE = Deno.env.get("MYSQL_TABLE") ?? "sessions_mod_test";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueTableName(prefix: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${prefix}_${suffix}`;
}

type MysqlExecutor = {
  query: (sql: string, params?: unknown[]) => Promise<[unknown, unknown]>;
  end: () => Promise<void>;
};

type MysqlPool = MysqlExecutor;

async function ensureTable(
  executor: MysqlExecutor,
  tableName: string,
): Promise<void> {
  await executor.query(
    `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      session_id VARCHAR(36) PRIMARY KEY,
      data TEXT NOT NULL,
      expires_at DATETIME NULL
    );
  `,
  );

  try {
    await executor.query(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_expires_at ON ${tableName}(expires_at);`,
    );
  } catch {
    // Ignore if the index already exists or IF NOT EXISTS is unsupported
  }
}

async function clearTable(
  executor: MysqlExecutor,
  tableName: string,
): Promise<void> {
  await executor.query(`DELETE FROM ${tableName}`);
}

async function withSqlStore<T>(
  fn: (store: SqlSessionStore) => Promise<T>,
): Promise<T> {
  let pool: MysqlPool | undefined;
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = mysql.createPool({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
    }) as unknown as MysqlPool;

    try {
      await candidate.query("SELECT 1");
      pool = candidate;
      break;
    } catch {
      await candidate.end().catch(() => {});
      await delay(1000);
    }
  }

  if (!pool) {
    throw new Error("Failed to connect to MySQL after multiple attempts.");
  }

  const tableName = uniqueTableName(MYSQL_TABLE);
  await ensureTable(pool, tableName);
  await clearTable(pool, tableName);

  const sqlClient = {
    execute: async (sql: string, params: unknown[] = []) => {
      const [rows] = await pool.query(sql, params);
      return {
        rows: Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [],
      };
    },
  };

  const sqlStore = new SqlSessionStore({ client: sqlClient, tableName });

  try {
    return await fn(sqlStore);
  } finally {
    await pool.end();
  }
}

Deno.test("use cookie store", async () => {
  const store = new CookieSessionStore();
  const sessionSaveRes = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/", (ctx) => {
        ctx.state.session.set("userId", "user123");
        return new Response("Hello, World!");
      }).handler();
    const req = new Request("http://localhost");
    const res = await handler(req);

    assertEquals(await res.text(), "Hello, World!");

    return res;
  })();

  const sessionCookie = extractSessionCookie(sessionSaveRes);

  {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/get", (ctx) => {
        const userId = ctx.state.session.get("userId") as string | undefined;
        return new Response(userId ?? "No User");
      })
      .handler();

    const req = new Request("http://localhost/get", {
      headers: {
        "Cookie": `fresh_session=${sessionCookie}`,
      },
    });
    const res = await handler(req);

    assertEquals(await res.text(), "user123");
  }
});

Deno.test("use kv store", async () => {
  const kv = await Deno.openKv(":memory:");
  const store = new KvSessionStore({ kv });

  const sessionSaveRes = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/", (ctx) => {
        ctx.state.session.set("userId", "user123");
        return new Response("Hello, World!");
      }).handler();
    const req = new Request("http://localhost");
    const res = await handler(req);

    assertEquals(await res.text(), "Hello, World!");

    return res;
  })();

  const sessionCookie = extractSessionCookie(sessionSaveRes);

  {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/get", (ctx) => {
        const userId = ctx.state.session.get("userId") as string | undefined;
        return new Response(userId ?? "No User");
      })
      .handler();

    const req = new Request("http://localhost/get", {
      headers: {
        "Cookie": `fresh_session=${sessionCookie}`,
      },
    });
    const res = await handler(req);

    assertEquals(await res.text(), "user123");
  }

  kv.close();
});

Deno.test("use redis store", async () => {
  const redisClient = await createRedisClient();

  const store = new RedisSessionStore({ client: redisClient });

  const sessionSaveRes = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/", (ctx) => {
        ctx.state.session.set("userId", "user123");
        return new Response("Hello, World!");
      }).handler();
    const req = new Request("http://localhost");
    const res = await handler(req);

    assertEquals(await res.text(), "Hello, World!");

    return res;
  })();

  const sessionCookie = extractSessionCookie(sessionSaveRes);

  {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/get", (ctx) => {
        const userId = ctx.state.session.get("userId") as string | undefined;
        return new Response(userId ?? "No User");
      })
      .handler();

    const req = new Request("http://localhost/get", {
      headers: {
        "Cookie": `fresh_session=${sessionCookie}`,
      },
    });
    const res = await handler(req);

    assertEquals(await res.text(), "user123");
  }
  await redisClient.flushall();
  await redisClient.close();
});

Deno.test({
  name: "use sql store (mysql)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    await withSqlStore(async (sqlStore) => {
    const sessionSaveRes = await (async () => {
      const handler = new App<State>()
        .use(session(sqlStore, TEST_SECRET))
        .get("/", (ctx) => {
          ctx.state.session.set("userId", "user123");
          return new Response("Hello, World!");
        }).handler();
      const req = new Request("http://localhost");
      const res = await handler(req);

      assertEquals(await res.text(), "Hello, World!");

      return res;
    })();

    const sessionCookie = extractSessionCookie(sessionSaveRes);

    {
      const handler = new App<State>()
        .use(session(sqlStore, TEST_SECRET))
        .get("/get", (ctx) => {
          const userId = ctx.state.session.get("userId") as string | undefined;
          return new Response(userId ?? "No User");
        })
        .handler();

      const req = new Request("http://localhost/get", {
        headers: {
          "Cookie": `fresh_session=${sessionCookie}`,
        },
      });
      const res = await handler(req);

      assertEquals(await res.text(), "user123");
    }
    });
  },
});

Deno.test({
  name: "flash message: set and get on next request",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const store = new MemorySessionStore();

  // First request: Set flash message
  const firstResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/set-flash", (ctx) => {
        ctx.state.session.flash.set("message", "Hello from flash!");
        ctx.state.session.flash.set("type", "success");
        return new Response("Flash set");
      }).handler();
    const req = new Request("http://localhost/set-flash");
    return await handler(req);
  })();

  const sessionCookie = extractSessionCookie(firstResponse);
  assertEquals(await firstResponse.text(), "Flash set");

  // Second request: Flash should be available
  const secondResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/get-flash", (ctx) => {
        const message = ctx.state.session.flash.get("message") as
          | string
          | undefined;
        const type = ctx.state.session.flash.get("type") as
          | string
          | undefined;
        const hasMessage = ctx.state.session.flash.has("message");
        return new Response(JSON.stringify({ message, type, hasMessage }));
      }).handler();

    const req = new Request("http://localhost/get-flash", {
      headers: {
        "Cookie": `fresh_session=${sessionCookie}`,
      },
    });
    return await handler(req);
  })();

  const secondCookie = extractSessionCookie(secondResponse);
  const secondData = await secondResponse.json();
  assertEquals(secondData.message, "Hello from flash!");
  assertEquals(secondData.type, "success");
  assertEquals(secondData.hasMessage, true);

  // Third request: Flash should be gone
  const thirdResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/get-flash-again", (ctx) => {
        const message = ctx.state.session.flash.get("message") as
          | string
          | undefined;
        const hasMessage = ctx.state.session.flash.has("message");
        return new Response(JSON.stringify({ message, hasMessage }));
      }).handler();

    const req = new Request("http://localhost/get-flash-again", {
      headers: {
        "Cookie": `fresh_session=${secondCookie}`,
      },
    });
    return await handler(req);
  })();

  const thirdData = await thirdResponse.json();
  assertEquals(thirdData.message, undefined);
  assertEquals(thirdData.hasMessage, false);
  },
});

Deno.test("flash message: does not affect regular session data", async () => {
  const store = new MemorySessionStore();

  // First request: Set both regular data and flash
  const firstResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/set", (ctx) => {
        ctx.state.session.set("persistent", "I stay");
        ctx.state.session.flash.set("temporary", "I go away");
        return new Response("Data set");
      }).handler();
    const req = new Request("http://localhost/set");
    return await handler(req);
  })();

  const sessionCookie = extractSessionCookie(firstResponse);

  // Second request: Both should be available, read flash
  const secondResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/get", (ctx) => {
        const persistent = ctx.state.session.get("persistent") as
          | string
          | undefined;
        const temporary = ctx.state.session.flash.get("temporary") as
          | string
          | undefined;
        return new Response(JSON.stringify({ persistent, temporary }));
      }).handler();

    const req = new Request("http://localhost/get", {
      headers: {
        "Cookie": `fresh_session=${sessionCookie}`,
      },
    });
    return await handler(req);
  })();

  const secondCookie = extractSessionCookie(secondResponse);
  const secondData = await secondResponse.json();
  assertEquals(secondData.persistent, "I stay");
  assertEquals(secondData.temporary, "I go away");

  // Third request: Regular data persists, flash is gone
  const thirdResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/get-again", (ctx) => {
        const persistent = ctx.state.session.get("persistent") as
          | string
          | undefined;
        const temporary = ctx.state.session.flash.get("temporary") as
          | string
          | undefined;
        return new Response(JSON.stringify({ persistent, temporary }));
      }).handler();

    const req = new Request("http://localhost/get-again", {
      headers: {
        "Cookie": `fresh_session=${secondCookie}`,
      },
    });
    return await handler(req);
  })();

  const thirdData = await thirdResponse.json();
  assertEquals(thirdData.persistent, "I stay");
  assertEquals(thirdData.temporary, undefined);
});

Deno.test("flash message: complex data types", async () => {
  const store = new MemorySessionStore();

  const flashData = {
    errors: ["Field is required", "Invalid format"],
    form: { name: "John", email: "john@example.com" },
    count: 42,
  };

  // Set flash with complex data
  const firstResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/set", (ctx) => {
        ctx.state.session.flash.set("formErrors", flashData);
        return new Response("OK");
      }).handler();
    const req = new Request("http://localhost/set");
    return await handler(req);
  })();

  const sessionCookie = extractSessionCookie(firstResponse);

  // Get flash data
  const secondResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET))
      .get("/get", (ctx) => {
        const formErrors = ctx.state.session.flash.get(
          "formErrors",
        ) as Record<
          string,
          unknown
        >;
        return new Response(JSON.stringify(formErrors));
      }).handler();

    const req = new Request("http://localhost/get", {
      headers: {
        "Cookie": `fresh_session=${sessionCookie}`,
      },
    });
    return await handler(req);
  })();

  const receivedData = await secondResponse.json();
  assertEquals(receivedData, flashData);
});

// Tests for sessionExpires configuration

/**
 * Mock store that captures expiresAt parameter
 */
class ExpiresCapturingStore extends MemorySessionStore {
  public capturedExpiresAt: Date | undefined;

  override async save(
    sessionId: string,
    data: Record<string, unknown>,
    expiresAt?: Date,
  ): Promise<string> {
    this.capturedExpiresAt = expiresAt;
    return await super.save(sessionId, data, expiresAt);
  }
}

Deno.test("sessionExpires: default expiration is passed to store", async () => {
  const store = new ExpiresCapturingStore();

  const handler = new App<State>()
    .use(session(store, TEST_SECRET))
    .get("/", (ctx) => {
      ctx.state.session.set("test", "value");
      return new Response("OK");
    }).handler();

  const req = new Request("http://localhost");
  await handler(req);

  // Default sessionExpires is 1 day (86400000 ms)
  const oneDayMs = 1000 * 60 * 60 * 24;
  const expectedMinExpires = Date.now() + oneDayMs - 1000; // Allow 1 second tolerance
  const expectedMaxExpires = Date.now() + oneDayMs + 1000;

  if (store.capturedExpiresAt) {
    const expiresTime = store.capturedExpiresAt.getTime();
    assertEquals(
      expiresTime >= expectedMinExpires && expiresTime <= expectedMaxExpires,
      true,
      `Expected expiresAt around ${
        new Date(Date.now() + oneDayMs).toISOString()
      }, got ${store.capturedExpiresAt.toISOString()}`,
    );
  } else {
    throw new Error("expiresAt was not passed to store");
  }
});

Deno.test("sessionExpires: custom expiration time is respected", async () => {
  const store = new ExpiresCapturingStore();
  const customExpires = 60 * 60 * 1000; // 1 hour

  const handler = new App<State>()
    .use(session(store, TEST_SECRET, { sessionExpires: customExpires }))
    .get("/", (ctx) => {
      ctx.state.session.set("test", "value");
      return new Response("OK");
    }).handler();

  const req = new Request("http://localhost");
  await handler(req);

  const expectedMinExpires = Date.now() + customExpires - 1000;
  const expectedMaxExpires = Date.now() + customExpires + 1000;

  if (store.capturedExpiresAt) {
    const expiresTime = store.capturedExpiresAt.getTime();
    assertEquals(
      expiresTime >= expectedMinExpires && expiresTime <= expectedMaxExpires,
      true,
      `Expected expiresAt around ${
        new Date(Date.now() + customExpires).toISOString()
      }, got ${store.capturedExpiresAt.toISOString()}`,
    );
  } else {
    throw new Error("expiresAt was not passed to store");
  }
});

Deno.test("sessionExpires: short expiration for quick expiry", async () => {
  const store = new ExpiresCapturingStore();
  const shortExpires = 5000; // 5 seconds

  const handler = new App<State>()
    .use(session(store, TEST_SECRET, { sessionExpires: shortExpires }))
    .get("/", (ctx) => {
      ctx.state.session.set("test", "value");
      return new Response("OK");
    }).handler();

  const req = new Request("http://localhost");
  await handler(req);

  const expectedMinExpires = Date.now() + shortExpires - 1000;
  const expectedMaxExpires = Date.now() + shortExpires + 1000;

  if (store.capturedExpiresAt) {
    const expiresTime = store.capturedExpiresAt.getTime();
    assertEquals(
      expiresTime >= expectedMinExpires && expiresTime <= expectedMaxExpires,
      true,
      `Expected expiresAt around ${
        new Date(Date.now() + shortExpires).toISOString()
      }, got ${store.capturedExpiresAt.toISOString()}`,
    );
  } else {
    throw new Error("expiresAt was not passed to store");
  }
});

Deno.test("sessionExpires: session data expires after configured time", async () => {
  const store = new MemorySessionStore();
  const shortExpires = 100; // 100ms for quick test

  // Create session
  const firstResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET, { sessionExpires: shortExpires }))
      .get("/set", (ctx) => {
        ctx.state.session.set("data", "test-value");
        return new Response("OK");
      }).handler();
    const req = new Request("http://localhost/set");
    return await handler(req);
  })();

  const sessionCookie = extractSessionCookie(firstResponse);

  // Wait for session to expire
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Try to read expired session
  const secondResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET, { sessionExpires: shortExpires }))
      .get("/get", (ctx) => {
        const data = ctx.state.session.get("data");
        return new Response(data ? String(data) : "no-data");
      }).handler();

    const req = new Request("http://localhost/get", {
      headers: {
        "Cookie": `fresh_session=${sessionCookie}`,
      },
    });
    return await handler(req);
  })();

  const text = await secondResponse.text();
  assertEquals(text, "no-data", "Session should have expired");
});

Deno.test("sessionExpires: session data persists before expiration", async () => {
  const store = new MemorySessionStore();
  const longExpires = 60000; // 1 minute

  // Create session
  const firstResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET, { sessionExpires: longExpires }))
      .get("/set", (ctx) => {
        ctx.state.session.set("data", "persisted-value");
        return new Response("OK");
      }).handler();
    const req = new Request("http://localhost/set");
    return await handler(req);
  })();

  const sessionCookie = extractSessionCookie(firstResponse);

  // Read session immediately (should not be expired)
  const secondResponse = await (async () => {
    const handler = new App<State>()
      .use(session(store, TEST_SECRET, { sessionExpires: longExpires }))
      .get("/get", (ctx) => {
        const data = ctx.state.session.get("data");
        return new Response(data ? String(data) : "no-data");
      }).handler();

    const req = new Request("http://localhost/get", {
      headers: {
        "Cookie": `fresh_session=${sessionCookie}`,
      },
    });
    return await handler(req);
  })();

  const text = await secondResponse.text();
  assertEquals(text, "persisted-value", "Session should still be valid");
});
