import { assertEquals } from "@std/assert";
import {
  CookieSessionStore,
  KvSessionStore,
  MemorySessionStore,
  type RedisClient,
  RedisSessionStore,
  session,
  type SessionState,
  SqlSessionStore,
} from "./mod.ts";
import { MockSqlClient } from "./src/storage/sql_test.ts";
import { App } from "@fresh/core";
// @ts-types="npm:@types/ioredis-mock"
import RedisMock from "ioredis-mock";

type State = Record<PropertyKey, never> & SessionState;

// Test secret key (32+ characters required)
const TEST_SECRET = "this-is-a-test-secret-key-32chars!";

// Extract session cookie value from Set-Cookie header
function extractSessionCookie(
  response: Response,
  cookieName = "fresh_session",
): string | null {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return null;

  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

Deno.test("use memory store", async () => {
  const store = new MemorySessionStore();
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

Deno.test("use redis store (ioredis-mock)", async () => {
  // deno-lint-ignore no-explicit-any
  const redisMock = new (RedisMock as any)();

  // Adapter to match RedisClient interface
  const redisClient: RedisClient = {
    get: (key: string) => redisMock.get(key),
    set: (key: string, value: string, options?: { ex?: number }) =>
      options?.ex
        ? redisMock.set(key, value, "EX", options.ex)
        : redisMock.set(key, value),
    del: (key: string) => redisMock.del(key),
  };

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
});

Deno.test("use sql store (mock)", async () => {
  const sqlClient = new MockSqlClient();
  const sqlStore = new SqlSessionStore({ client: sqlClient });

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
