import { assertEquals, assertExists } from "@std/assert";
import { type RedisClient, RedisSessionStore } from "./redis.ts";
// @deno-types="npm:@types/ioredis-mock"
import RedisMock from "ioredis-mock";

// 共有のRedisMockインスタンス（EventEmitterリークを防ぐ）
// deno-lint-ignore no-explicit-any
const sharedRedisMock = new (RedisMock as any)();

/**
 * ioredis-mockをRedisClientインターフェースにアダプト
 */
function createMockRedisClient(): RedisClient & {
  flushall: () => Promise<void>;
} {
  return {
    async get(key: string): Promise<string | null> {
      return await sharedRedisMock.get(key);
    },
    async set(
      key: string,
      value: string,
      options?: { ex?: number },
    ): Promise<void> {
      if (options?.ex) {
        await sharedRedisMock.set(key, value, "EX", options.ex);
      } else {
        await sharedRedisMock.set(key, value);
      }
    },
    async del(key: string): Promise<void> {
      await sharedRedisMock.del(key);
    },
    async flushall(): Promise<void> {
      await sharedRedisMock.flushall();
    },
  };
}

Deno.test("RedisSessionStore: load with undefined cookie creates new session", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    const result = await store.load(undefined);

    assertExists(result.sessionId);
    assertEquals(result.data, {});
    assertEquals(result.isNew, true);
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: load with non-existent sessionId creates new session", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    const result = await store.load("non-existent-session");

    assertExists(result.sessionId);
    assertEquals(result.data, {});
    assertEquals(result.isNew, true);
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: save and load session data", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    // 新規セッション作成
    const { sessionId } = await store.load(undefined);
    const data = { userId: "user123", role: "admin" };

    // データ保存
    const cookieValue = await store.save(sessionId, data);
    assertEquals(cookieValue, sessionId); // RedisStoreはsessionIdをそのまま返す

    // データ読み込み
    const result = await store.load(sessionId);
    assertEquals(result.sessionId, sessionId);
    assertEquals(result.data, data);
    assertEquals(result.isNew, false);
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: destroy removes session", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    // セッション作成と保存
    const { sessionId } = await store.load(undefined);
    await store.save(sessionId, { foo: "bar" });

    // 破棄
    await store.destroy(sessionId);

    // 破棄後は新規セッション扱い
    const result = await store.load(sessionId);
    assertEquals(result.isNew, true);
    assertEquals(result.data, {});
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: expired session returns new session", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    const sessionId = "expired-session";
    const data = { temp: "data" };
    const pastDate = new Date(Date.now() - 10000); // 10秒前

    await store.save(sessionId, data, pastDate);
    const result = await store.load(sessionId);

    // 期限切れなので新規セッション扱い
    assertEquals(result.isNew, true);
    assertEquals(result.data, {});
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: non-expired session returns data", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    const sessionId = "valid-session";
    const data = { active: true };
    const futureDate = new Date(Date.now() + 60000); // 1分後

    await store.save(sessionId, data, futureDate);
    const result = await store.load(sessionId);

    assertEquals(result.sessionId, sessionId);
    assertEquals(result.data, data);
    assertEquals(result.isNew, false);
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: update existing session", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    const sessionId = "update-session";

    await store.save(sessionId, { count: 1 });
    await store.save(sessionId, { count: 2 });

    const result = await store.load(sessionId);
    assertEquals(result.data, { count: 2 });
    assertEquals(result.isNew, false);
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: session with no expiry persists", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    const sessionId = "persistent-session";
    const data = { persistent: true };

    await store.save(sessionId, data);
    const result = await store.load(sessionId);

    assertEquals(result.data, data);
    assertEquals(result.isNew, false);
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: custom key prefix", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client, keyPrefix: "custom:" });

  try {
    const sessionId = "test-session";
    const data = { custom: "prefix" };

    await store.save(sessionId, data);

    // カスタムプレフィックスで保存されていることを確認
    const storedValue = await client.get("custom:test-session");
    assertExists(storedValue);

    const result = await store.load(sessionId);
    assertEquals(result.data, data);
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: complex data types", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    const { sessionId } = await store.load(undefined);
    const complexData = {
      user: {
        id: 123,
        name: "Test User",
        roles: ["admin", "user"],
      },
      settings: {
        theme: "dark",
        notifications: true,
      },
      lastLogin: "2024-01-01T00:00:00.000Z",
    };

    await store.save(sessionId, complexData);
    const result = await store.load(sessionId);

    assertEquals(result.data, complexData);
    assertEquals(result.isNew, false);
  } finally {
    await client.flushall();
  }
});

Deno.test("RedisSessionStore: invalid JSON in Redis returns new session", async () => {
  const client = createMockRedisClient();
  const store = new RedisSessionStore({ client });

  try {
    // 不正なJSONを直接設定
    await client.set("session:invalid-json", "not valid json");

    const result = await store.load("invalid-json");

    assertEquals(result.isNew, true);
    assertEquals(result.data, {});
  } finally {
    await client.flushall();
  }
});
