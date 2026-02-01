import { assertEquals, assertExists } from "@std/assert";
import { type SqlClient, SqlSessionStore } from "./sql.ts";
import mysql from "mysql2/promise";

const MYSQL_HOST = Deno.env.get("MYSQL_HOST") ?? "127.0.0.1";
const MYSQL_PORT = Number(Deno.env.get("MYSQL_PORT") ?? "3307");
const MYSQL_USER = Deno.env.get("MYSQL_USER") ?? "root";
const MYSQL_PASSWORD = Deno.env.get("MYSQL_PASSWORD") ?? "root";
const MYSQL_DATABASE = Deno.env.get("MYSQL_DATABASE") ?? "fresh_session";
const MYSQL_TABLE = Deno.env.get("MYSQL_TABLE") ?? "sessions";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueTableName(prefix: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${prefix}_${suffix}`;
}

function sqlTest(
  name: string,
  fn: () => Promise<void>,
): void {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn,
  });
}

type MysqlExecutor = {
  query: (sql: string, params?: unknown[]) => Promise<[unknown, unknown]>;
};

type MysqlPool = MysqlExecutor & { end: () => Promise<void> };

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

async function withStore<T>(
  tableName: string,
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

  const client: SqlClient = {
    execute: async (sql: string, params: unknown[] = []) => {
      const [rows] = await pool.query(sql, params);
      return {
        rows: Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [],
      };
    },
  };

  await ensureTable(pool, tableName);
  await clearTable(pool, tableName);

  const store = new SqlSessionStore({ client, tableName });

  try {
    return await fn(store);
  } finally {
    await pool.end();
  }
}

sqlTest("SqlSessionStore: load with undefined cookie creates new session", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
    const result = await store.load(undefined);

    assertExists(result.sessionId);
    assertEquals(result.data, {});
    assertEquals(result.isNew, true);
  });
});

sqlTest("SqlSessionStore: load with non-existent sessionId creates new session", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
    const result = await store.load("non-existent-session");

    assertExists(result.sessionId);
    assertEquals(result.data, {});
    assertEquals(result.isNew, true);
  });
});

sqlTest("SqlSessionStore: save and load session data", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
    const { sessionId } = await store.load(undefined);
    const data = { userId: "user123", role: "admin" };

    const cookieValue = await store.save(sessionId, data);
    assertEquals(cookieValue, sessionId);

    const result = await store.load(sessionId);
    assertEquals(result.sessionId, sessionId);
    assertEquals(result.data, data);
    assertEquals(result.isNew, false);
  });
});

sqlTest("SqlSessionStore: destroy removes session", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
    const { sessionId } = await store.load(undefined);
    await store.save(sessionId, { foo: "bar" });

    await store.destroy(sessionId);

    const result = await store.load(sessionId);
    assertEquals(result.isNew, true);
    assertEquals(result.data, {});
  });
});

sqlTest("SqlSessionStore: expired session returns new session", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
    const sessionId = "expired-session";
    const data = { temp: "data" };
    const pastDate = new Date(Date.now() - 10000);

    await store.save(sessionId, data, pastDate);
    const result = await store.load(sessionId);

    assertEquals(result.isNew, true);
    assertEquals(result.data, {});
  });
});

sqlTest("SqlSessionStore: non-expired session returns data", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
    const sessionId = "valid-session";
    const data = { active: true };
    const futureDate = new Date(Date.now() + 60000);

    await store.save(sessionId, data, futureDate);
    const result = await store.load(sessionId);

    assertEquals(result.sessionId, sessionId);
    assertEquals(result.data, data);
    assertEquals(result.isNew, false);
  });
});

sqlTest("SqlSessionStore: update existing session", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
    const sessionId = "update-session";

    await store.save(sessionId, { count: 1 });
    await store.save(sessionId, { count: 2 });

    const result = await store.load(sessionId);
    assertEquals(result.data, { count: 2 });
    assertEquals(result.isNew, false);
  });
});

sqlTest("SqlSessionStore: session with no expiry persists", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
    const sessionId = "persistent-session";
    const data = { persistent: true };

    await store.save(sessionId, data);
    const result = await store.load(sessionId);

    assertEquals(result.data, data);
    assertEquals(result.isNew, false);
  });
});

sqlTest("SqlSessionStore: custom table name", async () => {
  await withStore(uniqueTableName("custom_sessions"), async (store) => {
    const sessionId = "test-session";
    const data = { custom: "table" };

    await store.save(sessionId, data);
    const result = await store.load(sessionId);

    assertEquals(result.data, data);
  });
});

sqlTest("SqlSessionStore: complex data types", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
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
});

sqlTest("SqlSessionStore: cleanup removes expired sessions", async () => {
  await withStore(uniqueTableName(MYSQL_TABLE), async (store) => {
    await store.save("expired-1", { a: 1 }, new Date(Date.now() - 10000));
    await store.save("expired-2", { b: 2 }, new Date(Date.now() - 5000));

    await store.save("valid-1", { c: 3 }, new Date(Date.now() + 60000));
    await store.save("no-expiry", { d: 4 });

    await store.cleanup();

    const expired1 = await store.load("expired-1");
    assertEquals(expired1.isNew, true);

    const expired2 = await store.load("expired-2");
    assertEquals(expired2.isNew, true);

    const valid1 = await store.load("valid-1");
    assertEquals(valid1.data, { c: 3 });
    assertEquals(valid1.isNew, false);

    const noExpiry = await store.load("no-expiry");
    assertEquals(noExpiry.data, { d: 4 });
    assertEquals(noExpiry.isNew, false);
  });
});
