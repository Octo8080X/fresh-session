import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { cookieSession, WithSession } from "fresh-session";

export type State = {} & WithSession;

export function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  console.log(req.url);
  return cookieSession(req, ctx);
}
