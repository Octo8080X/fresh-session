import { session, SqlSessionStore } from "@octo8080x/fresh-session";
import { Pool } from "pg";
import type { State } from "./main.ts";

const pgHost = Deno.env.get("POSTGRES_HOST") ?? "127.0.0.1";
const pgPort = Number(Deno.env.get("POSTGRES_PORT") ?? "5432");
const pgUser = Deno.env.get("POSTGRES_USER") ?? "postgres";
const pgPassword = Deno.env.get("POSTGRES_PASSWORD") ?? "postgres";
const pgDatabase = Deno.env.get("POSTGRES_DATABASE") ?? "fresh_session";
const pgTable = Deno.env.get("POSTGRES_TABLE") ?? "sessions";

const pool = new Pool({
  host: pgHost,
  port: pgPort,
  user: pgUser,
  password: pgPassword,
  database: pgDatabase,
  max: 4,
});

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres(): Promise<void> {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch {
      await delay(1000);
    }
  }
  throw new Error("Failed to connect to PostgreSQL after multiple attempts.");
}

const createTableSql = `
  CREATE TABLE IF NOT EXISTS ${pgTable} (
    session_id VARCHAR(36) PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at TIMESTAMP NULL
  );
`;

await waitForPostgres();
await pool.query(createTableSql);
await pool.query(
  `CREATE INDEX IF NOT EXISTS idx_${pgTable}_expires_at ON ${pgTable}(expires_at);`,
);

const sqlClient = {
  execute: async (sql: string, params: unknown[] = []) => {
    const result = await pool.query(sql, params);
    return {
      rows: result.rows as Record<string, unknown>[],
    };
  },
};

const postgresSessionStore = new SqlSessionStore({
  client: sqlClient,
  tableName: pgTable,
  dialect: "postgres",
});

export const postgresSessionMiddleware = session<State>(
  postgresSessionStore,
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
