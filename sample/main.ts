import { App, createDefine, staticFiles, type Middleware } from "@fresh/core";
import { memorySessionMiddleware } from "./session_memory.ts";
import { cookieSessionMiddleware } from "./session_cookie.ts";
import { kvSessionMiddleware } from "./session_kv.ts";
import { registerSessionDemoRoutes } from "./session_demo.tsx";
import type { SessionState } from "../src/session.ts";

export interface State extends SessionState {
  shared: string;
}

export const define = createDefine<State>();

export const app = new App<State>();

app.use(staticFiles());

// select session middleware
async function selectSessionMiddleware(
  sessionType?: string,
): Promise<{ storeType: string; sessionMiddleware: Middleware<State> }> {
  switch (sessionType) {
    case ("cookie"): {
      return {
        storeType: "cookie",
        sessionMiddleware: cookieSessionMiddleware,
      };
    }
    case ("memory"): {
      return {
        storeType: "memory",
        sessionMiddleware: memorySessionMiddleware,
      };
    }
    case ("kv"): {
      return {
        storeType: "kv",
        sessionMiddleware: kvSessionMiddleware,
      };
    }
    case ("redis"): {
      const { redisSessionMiddleware } = await import("./session_redis.ts");
      return {
        storeType: "redis",
        sessionMiddleware: redisSessionMiddleware,
      };
    }
    case ("mysql"): {
      const { mysqlSessionMiddleware } = await import("./session_mysql.ts");
      return {
        storeType: "mysql",
        sessionMiddleware: mysqlSessionMiddleware,
      };
    }
    case ("postgres"): {
      const { postgresSessionMiddleware } = await import(
        "./session_postgres.ts"
      );
      return {
        storeType: "postgres",
        sessionMiddleware: postgresSessionMiddleware,
      };
    }
    default: {
      return {
        storeType: "memory",
        sessionMiddleware: memorySessionMiddleware,
      };
    }
  }
}

const { storeType, sessionMiddleware } = await selectSessionMiddleware(
  Deno.args[0],
);

app.use(sessionMiddleware);

const exampleLoggerMiddleware = define.middleware((ctx) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  return ctx.next();
});
app.use(exampleLoggerMiddleware);

// Register session demo routes
registerSessionDemoRoutes(app, storeType);

// When no route matches, redirect to top page
app.use((ctx) => {
  const url = new URL("/", ctx.req.url);
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  });
});

app.listen();
