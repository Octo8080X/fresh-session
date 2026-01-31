import { App, createDefine, staticFiles } from "@fresh/core";
import { sessionMiddleware } from "./session.ts";
import { registerSessionDemoRoutes } from "./session_demo.tsx";
import type { SessionState } from "../src/session.ts";

export interface State extends SessionState {
  shared: string;
}

export const define = createDefine<State>();

export const app = new App<State>();

app.use(staticFiles());

// Ignore .well-known requests (e.g., Chrome DevTools)
app.all("/.well-known/*", () => {
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// Add session middleware
app.use(sessionMiddleware);

const exampleLoggerMiddleware = define.middleware((ctx) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  return ctx.next();
});
app.use(exampleLoggerMiddleware);

// Register session demo routes
registerSessionDemoRoutes(app);

// When no route matches, redirect to top page
app.use((ctx) => {
  const url = new URL("/", ctx.req.url);
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  });
});

app.listen();
