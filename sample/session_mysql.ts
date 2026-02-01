import { SqlSessionStore, session } from "@octo8080x/fresh-session";
import mysql from "mysql2/promise";
import type { State } from "./main.ts";

const mysqlHost = Deno.env.get("MYSQL_HOST") ?? "127.0.0.1";
const mysqlPort = Number(Deno.env.get("MYSQL_PORT") ?? "3306");
const mysqlUser = Deno.env.get("MYSQL_USER") ?? "root";
const mysqlPassword = Deno.env.get("MYSQL_PASSWORD") ?? "";
const mysqlDatabase = Deno.env.get("MYSQL_DATABASE") ?? "fresh_session";
const mysqlTable = Deno.env.get("MYSQL_TABLE") ?? "sessions";

type MysqlPool = {
  query: (sql: string, params?: unknown[]) => Promise<[unknown, unknown]>;
};

const pool = mysql.createPool({
  host: mysqlHost,
  port: mysqlPort,
  user: mysqlUser,
  password: mysqlPassword,
  database: mysqlDatabase,
  connectionLimit: 4,
}) as unknown as MysqlPool;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMysql(): Promise<void> {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch {
      await delay(1000);
    }
  }
  throw new Error("Failed to connect to MySQL after multiple attempts.");
}

const createTableSql = `
  CREATE TABLE IF NOT EXISTS ${mysqlTable} (
    session_id VARCHAR(36) PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at DATETIME NULL
  );
`;

await waitForMysql();
await pool.query(createTableSql);
await pool.query(
  `CREATE INDEX IF NOT EXISTS idx_${mysqlTable}_expires_at ON ${mysqlTable}(expires_at);`,
).catch(() => {});

const sqlClient = {
  execute: async (sql: string, params: unknown[] = []) => {
    const [rows] = await pool.query(sql, params);
    return {
      rows: Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [],
    };
  },
};

const mysqlSessionStore = new SqlSessionStore({
  client: sqlClient,
  tableName: mysqlTable,
});

export const mysqlSessionMiddleware = session<State>(
  mysqlSessionStore,
  "your-secret-key-at-least-32-characters-long",
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
