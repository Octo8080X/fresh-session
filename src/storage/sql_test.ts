import { assertEquals, assertExists } from "@std/assert";
import { type SqlClient, SqlSessionStore } from "./sql.ts";

/**
 * Mock SQL client for testing
 * Simulates SQL datetime format (YYYY-MM-DD HH:MM:SS)
 */
export class MockSqlClient implements SqlClient {
  private store = new Map<
    string,
    { data: string; expires_at: string | null }
  >();

  async execute(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows?: Record<string, unknown>[] }> {
    // SELECT
    if (sql.includes("SELECT")) {
      const sessionId = params?.[0] as string;
      const entry = this.store.get(sessionId);
      if (!entry) {
        return { rows: [] };
      }
      // MySQL expects expires in ISO format
      return {
        rows: [{
          data: entry.data,
          expires_at: entry.expires_at
            ? entry.expires_at.replace(" ", "T") + "Z"
            : null,
        }],
      };
    }

    // INSERT ... ON DUPLICATE KEY UPDATE
    if (sql.includes("INSERT")) {
      const sessionId = params?.[0] as string;
      const data = params?.[1] as string;
      const expiresAt = params?.[2] as string | null;
      this.store.set(sessionId, { data, expires_at: expiresAt });
      return {};
    }

    // DELETE
    if (sql.includes("DELETE") && sql.includes("session_id")) {
      const sessionId = params?.[0] as string;
      this.store.delete(sessionId);
      return {};
    }

    // DELETE expired (cleanup)
    if (sql.includes("DELETE") && sql.includes("NOW()")) {
      const now = new Date();
      for (const [key, value] of this.store.entries()) {
        if (value.expires_at) {
          // Parse MySQL format
          const expiresAt = new Date(value.expires_at.replace(" ", "T") + "Z");
          if (expiresAt < now) {
            this.store.delete(key);
          }
        }
      }
      return {};
    }

    return {};
  }

  // Test helper
  clear(): void {
    this.store.clear();
  }
}

Deno.test("SqlSessionStore: load with undefined cookie creates new session", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

  const result = await store.load(undefined);

  assertExists(result.sessionId);
  assertEquals(result.data, {});
  assertEquals(result.isNew, true);
});

Deno.test("SqlSessionStore: load with non-existent sessionId creates new session", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

  const result = await store.load("non-existent-session");

  assertExists(result.sessionId);
  assertEquals(result.data, {});
  assertEquals(result.isNew, true);
});

Deno.test("SqlSessionStore: save and load session data", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

  // Create new session
  const { sessionId } = await store.load(undefined);
  const data = { userId: "user123", role: "admin" };

  // Save data
  const cookieValue = await store.save(sessionId, data);
  assertEquals(cookieValue, sessionId);

  // Load data
  const result = await store.load(sessionId);
  assertEquals(result.sessionId, sessionId);
  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});

Deno.test("SqlSessionStore: destroy removes session", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

  // Create and save session
  const { sessionId } = await store.load(undefined);
  await store.save(sessionId, { foo: "bar" });

  // Destroy
  await store.destroy(sessionId);

  // After destruction, treated as new session
  const result = await store.load(sessionId);
  assertEquals(result.isNew, true);
  assertEquals(result.data, {});
});

Deno.test("SqlSessionStore: expired session returns new session", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

  const sessionId = "expired-session";
  const data = { temp: "data" };
  const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

  await store.save(sessionId, data, pastDate);
  const result = await store.load(sessionId);

  // Treated as new session because expired
  assertEquals(result.isNew, true);
  assertEquals(result.data, {});
});

Deno.test("SqlSessionStore: non-expired session returns data", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

  const sessionId = "valid-session";
  const data = { active: true };
  const futureDate = new Date(Date.now() + 60000); // 1 minute later

  await store.save(sessionId, data, futureDate);
  const result = await store.load(sessionId);

  assertEquals(result.sessionId, sessionId);
  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});

Deno.test("SqlSessionStore: update existing session", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

  const sessionId = "update-session";

  await store.save(sessionId, { count: 1 });
  await store.save(sessionId, { count: 2 });

  const result = await store.load(sessionId);
  assertEquals(result.data, { count: 2 });
  assertEquals(result.isNew, false);
});

Deno.test("SqlSessionStore: session with no expiry persists", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

  const sessionId = "persistent-session";
  const data = { persistent: true };

  await store.save(sessionId, data);
  const result = await store.load(sessionId);

  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});

Deno.test("SqlSessionStore: custom table name", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client, tableName: "custom_sessions" });

  const sessionId = "test-session";
  const data = { custom: "table" };

  await store.save(sessionId, data);
  const result = await store.load(sessionId);

  assertEquals(result.data, data);
});

Deno.test("SqlSessionStore: complex data types", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

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
});

Deno.test("SqlSessionStore: cleanup removes expired sessions", async () => {
  const client = new MockSqlClient();
  const store = new SqlSessionStore({ client });

  // Expired sessions
  await store.save("expired-1", { a: 1 }, new Date(Date.now() - 10000));
  await store.save("expired-2", { b: 2 }, new Date(Date.now() - 5000));

  // Valid sessions
  await store.save("valid-1", { c: 3 }, new Date(Date.now() + 60000));
  await store.save("no-expiry", { d: 4 }); // No expiry

  await store.cleanup();

  // Expired sessions are deleted
  const expired1 = await store.load("expired-1");
  assertEquals(expired1.isNew, true);

  const expired2 = await store.load("expired-2");
  assertEquals(expired2.isNew, true);

  // Valid sessions remain
  const valid1 = await store.load("valid-1");
  assertEquals(valid1.data, { c: 3 });
  assertEquals(valid1.isNew, false);

  const noExpiry = await store.load("no-expiry");
  assertEquals(noExpiry.data, { d: 4 });
  assertEquals(noExpiry.isNew, false);
});
