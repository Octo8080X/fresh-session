import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { redisSession, WithSession } from "fresh-session/mod.ts";
import { connect } from "redis/mod.ts";
import { PORT } from "../main.ts";
export type State = WithSession;

const redis = await connect({
  hostname: "redis",
  port: 6379,
});

const session = redisSession(redis, {
  maxAge: 10,
  httpOnly: true,
});

function sessionHundler(req: Request, ctx: MiddlewareHandlerContext<State>) {
  if (req.url === `http://localhost:${ctx.localAddr?.port}/`) {
    return session(req, ctx);
  }
  if (req.url === `http://localhost:${PORT}/`) {
    return session(req, ctx);
  }
  return ctx.next();
}
export const handler = [sessionHundler];
