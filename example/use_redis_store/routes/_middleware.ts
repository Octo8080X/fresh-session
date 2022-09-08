import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { CreateRedisSession, WithSession } from "fresh-session/mod.ts";
import { connect } from "redis/mod.ts";
export type State = WithSession;

const redis = await connect({
  hostname: "redis",
  port: 6379,
});

const redisSession = CreateRedisSession(redis);

function session(req: Request, ctx: MiddlewareHandlerContext<State>) {
  if (req.url === `http://localhost:${ctx.localAddr?.port}/`) {
    return redisSession(req, ctx);
  }
  return ctx.next();
}
export const handler = [session];
