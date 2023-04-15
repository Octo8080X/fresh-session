import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { kvSession, WithSession } from "fresh-session/mod.ts";
export type State = WithSession;

async function sessionHundler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  const session = kvSession(null, {
    maxAge: 10,
    httpOnly: true,
  });

  if (req.url === `http://localhost:${ctx.localAddr?.port}/`) {
    return session(req, ctx);
  }
  return ctx.next();
}
export const handler = [sessionHundler];
