import { assertEquals, assertExists } from "@std/assert";
import { connect } from "@db/redis";
import { type RedisClient, RedisSessionStore } from "./redis.ts";

type ConnectedRedisClient = RedisClient & {
  flushall: () => Promise<void>;
  close: () => Promise<void>;
};

export async function createRedisClient(): Promise<ConnectedRedisClient> {
  const redisHost = Deno.env.get("REDIS_HOST") ?? "127.0.0.1";
  const redisPort = Number(Deno.env.get("REDIS_PORT") ?? "6379");
  const redis = await connect({ hostname: redisHost, port: redisPort });

  return {
    get: (key: string) => redis.get(key),
    set: (key: string, value: string, options?: { ex?: number }) =>
      redis
        .set(key, value, options?.ex ? { ex: options.ex } : undefined)
        .then(() => {}),
    del: (key: string) => redis.del(key).then(() => {}),
    flushall: () => redis.flushdb().then(() => {}),
    close: async () => {
      await redis.close();
    },
  };
}

Deno.test({
  name: "RedisSessionStore: load with undefined cookie creates new session",
  fn: async () => {
    const client = await createRedisClient();
    const store = new RedisSessionStore({ client });

    try {
      const result = await store.load(undefined);

      assertExists(result.sessionId);
      assertEquals(result.data, {});
      assertEquals(result.isNew, true);
    } finally {
      await client.flushall();
      await client.close();
    }
  },
});

Deno.test({
  name:
    "RedisSessionStore: load with non-existent sessionId creates new session",
  fn: async () => {
    const client = await createRedisClient();
    const store = new RedisSessionStore({ client });

    try {
      const result = await store.load("non-existent-session");

      assertExists(result.sessionId);
      assertEquals(result.data, {});
      assertEquals(result.isNew, true);
    } finally {
      await client.flushall();
      await client.close();
    }
  },
});

Deno.test({
  name: "RedisSessionStore: save and load session data",
  fn: async () => {
    const client = await createRedisClient();
    const store = new RedisSessionStore({ client });

    try {
      // Create new session
      const { sessionId } = await store.load(undefined);
      const data = { userId: "user123", role: "admin" };

      // Save data
      const cookieValue = await store.save(sessionId, data);
      assertEquals(cookieValue, sessionId); // RedisStore returns sessionId as-is

      // Load data
      const result = await store.load(sessionId);
      assertEquals(result.sessionId, sessionId);
      assertEquals(result.data, data);
      assertEquals(result.isNew, false);
    } finally {
      await client.flushall();
      await client.close();
    }
  },
});

Deno.test({
  name: "RedisSessionStore: destroy removes session",
  fn: async () => {
    const client = await createRedisClient();
    const store = new RedisSessionStore({ client });

    try {
      // Create and save session
      const { sessionId } = await store.load(undefined);
      await store.save(sessionId, { foo: "bar" });

      // Destroy
      await store.destroy(sessionId);

      // After destruction, treated as new session
      const result = await store.load(sessionId);
      assertEquals(result.isNew, true);
      assertEquals(result.data, {});
    } finally {
      await client.flushall();
      await client.close();
    }
  },
});

Deno.test({
  name: "RedisSessionStore: expired session returns new session",
  fn: async () => {
    const client = await createRedisClient();
    const store = new RedisSessionStore({ client });

    try {
      const sessionId = "expired-session";
      const data = { temp: "data" };
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

      await store.save(sessionId, data, pastDate);
      const result = await store.load(sessionId);

      // Treated as new session because expired
      assertEquals(result.isNew, true);
      assertEquals(result.data, {});
    } finally {
      await client.flushall();
      await client.close();
    }
  },
});

Deno.test({
  name: "RedisSessionStore: non-expired session returns data",
  fn: async () => {
    const client = await createRedisClient();
    const store = new RedisSessionStore({ client });

    try {
      const sessionId = "valid-session";
      const data = { active: true };
      const futureDate = new Date(Date.now() + 60000); // 1 minute later

      await store.save(sessionId, data, futureDate);
      const result = await store.load(sessionId);

      assertEquals(result.sessionId, sessionId);
      assertEquals(result.data, data);
      assertEquals(result.isNew, false);
    } finally {
      await client.flushall();
      await client.close();
    }
  },
});

Deno.test({
  name: "RedisSessionStore: update existing session",
  fn: async () => {
    const client = await createRedisClient();
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
      await client.close();
    }
  },
});

Deno.test({
  name: "RedisSessionStore: session with no expiry persists",
  fn: async () => {
    const client = await createRedisClient();
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
      await client.close();
    }
  },
});

Deno.test({
  name: "RedisSessionStore: custom key prefix",
  fn: async () => {
    const client = await createRedisClient();
    const store = new RedisSessionStore({ client, keyPrefix: "custom:" });

    try {
      const sessionId = "test-session";
      const data = { custom: "prefix" };

      await store.save(sessionId, data);

      // Verify saved with custom prefix
      const storedValue = await client.get("custom:test-session");
      assertExists(storedValue);

      const result = await store.load(sessionId);
      assertEquals(result.data, data);
    } finally {
      await client.flushall();
      await client.close();
    }
  },
});

Deno.test({
  name: "RedisSessionStore: complex data types",
  fn: async () => {
    const client = await createRedisClient();
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
      await client.close();
    }
  },
});

Deno.test({
  name: "RedisSessionStore: invalid JSON in Redis returns new session",
  fn: async () => {
    const client = await createRedisClient();
    const store = new RedisSessionStore({ client });

    try {
      // Set invalid JSON directly
      await client.set("session:invalid-json", "not valid json");

      const result = await store.load("invalid-json");

      assertEquals(result.isNew, true);
      assertEquals(result.data, {});
    } finally {
      await client.flushall();
      await client.close();
    }
  },
});
