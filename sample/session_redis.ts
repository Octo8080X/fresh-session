import { RedisSessionStore, session, type RedisClient } from "@octo8080x/fresh-session";
import { connect } from "@db/redis";
import type { State } from "./main.ts";

const redisHost = Deno.env.get("REDIS_HOST") ?? "127.0.0.1";
const redisPort = Number(Deno.env.get("REDIS_PORT") ?? "6379");

const redis = await connect({
  hostname: redisHost,
  port: redisPort,
});

const redisClient: RedisClient = {
  get: (key: string) => redis.get(key),
  set: (key: string, value: string, options?: { ex?: number }) =>
    redis
      .set(key, value, options?.ex ? { ex: options.ex } : undefined)
      .then(() => {}),
  del: (key: string) => redis.del(key).then(() => {}),
};

// RedisSessionStore (session data stored in Redis)
const redisSessionStore = new RedisSessionStore({ client: redisClient });

/**
 * Session middleware (Redis store)
 * Stores session data in Redis
 */
export const redisSessionMiddleware = session<State>(
  redisSessionStore,
  "your-secret-key-at-least-32-characters-long", // In production, get from environment variable
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
