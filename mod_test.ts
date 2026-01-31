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

Deno.test("flash message: set and get on next request", async () => {
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
        const type = ctx.state.session.flash.get("type") as string | undefined;
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
        const formErrors = ctx.state.session.flash.get("formErrors") as Record<
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
