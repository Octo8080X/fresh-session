import { App, createDefine, staticFiles } from "@fresh/core";
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

let storeType = "memory";

// Add session middleware
switch (Deno.args[0]) {
  case ("cookie"): {
    app.use(cookieSessionMiddleware);
    storeType = "cookie";
    break;
  }
  case ("memory"): {
    app.use(memorySessionMiddleware);
    storeType = "memory";
    break;
  }
  case ("kv"): {
    app.use(kvSessionMiddleware);
    storeType = "kv";
    break;
  }
  case ("redis"): {
    const { redisSessionMiddleware } = await import("./session_redis.ts");
    app.use(redisSessionMiddleware);
    storeType = "redis";
    break;
  }
  case ("mysql"): {
    const { mysqlSessionMiddleware } = await import("./session_mysql.ts");
    app.use(mysqlSessionMiddleware);
    storeType = "mysql";
    break;
  }
  case ("postgres"): {
    const { postgresSessionMiddleware } = await import(
      "./session_postgres.ts"
    );
    app.use(postgresSessionMiddleware);
    storeType = "postgres";
    break;
  }
  default: {
    app.use(memorySessionMiddleware);
  }
}

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
