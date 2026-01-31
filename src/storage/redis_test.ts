import { assertEquals, assertExists } from "@std/assert";
import { type RedisClient, RedisSessionStore } from "./redis.ts";

type RedisMockLike = {
  get: (key: string) => Promise<string | null>;
  set: (
    key: string,
    value: string,
    mode?: string,
    ttl?: number,
  ) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
  flushall: () => Promise<unknown>;
};

let sharedRedisMockPromise: Promise<RedisMockLike> | undefined;

const envGranted =
  (await Deno.permissions.query({ name: "env" })).state === "granted";

async function getSharedRedisMock(): Promise<RedisMockLike> {
  if (!sharedRedisMockPromise) {
    sharedRedisMockPromise = (async () => {
      const { default: RedisMock } = await import("ioredis-mock");
      const RedisMockCtor = RedisMock as unknown as new () => RedisMockLike;
      return new RedisMockCtor();
    })();
  }
  return await sharedRedisMockPromise;
}

/**
 * Adapt ioredis-mock to RedisClient interface
 */
async function createMockRedisClient(): Promise<
  RedisClient & {
    flushall: () => Promise<void>;
  }
> {
  const sharedRedisMock = await getSharedRedisMock();
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

if (envGranted) {
  Deno.test({
    name: "RedisSessionStore: load with undefined cookie creates new session",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
      const store = new RedisSessionStore({ client });

      try {
        const result = await store.load(undefined);

        assertExists(result.sessionId);
        assertEquals(result.data, {});
        assertEquals(result.isNew, true);
      } finally {
        await client.flushall();
      }
    },
  });

  Deno.test({
    name:
      "RedisSessionStore: load with non-existent sessionId creates new session",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
      const store = new RedisSessionStore({ client });

      try {
        const result = await store.load("non-existent-session");

        assertExists(result.sessionId);
        assertEquals(result.data, {});
        assertEquals(result.isNew, true);
      } finally {
        await client.flushall();
      }
    },
  });

  Deno.test({
    name: "RedisSessionStore: save and load session data",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
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
      }
    },
  });

  Deno.test({
    name: "RedisSessionStore: destroy removes session",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
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
      }
    },
  });

  Deno.test({
    name: "RedisSessionStore: expired session returns new session",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
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
      }
    },
  });

  Deno.test({
    name: "RedisSessionStore: non-expired session returns data",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
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
      }
    },
  });

  Deno.test({
    name: "RedisSessionStore: update existing session",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
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
    },
  });

  Deno.test({
    name: "RedisSessionStore: session with no expiry persists",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
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
    },
  });

  Deno.test({
    name: "RedisSessionStore: custom key prefix",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
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
      }
    },
  });

  Deno.test({
    name: "RedisSessionStore: complex data types",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
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
    },
  });

  Deno.test({
    name: "RedisSessionStore: invalid JSON in Redis returns new session",
    permissions: { env: true },
    fn: async () => {
      const client = await createMockRedisClient();
      const store = new RedisSessionStore({ client });

      try {
        // Set invalid JSON directly
        await client.set("session:invalid-json", "not valid json");

        const result = await store.load("invalid-json");

        assertEquals(result.isNew, true);
        assertEquals(result.data, {});
      } finally {
        await client.flushall();
      }
    },
  });
}
