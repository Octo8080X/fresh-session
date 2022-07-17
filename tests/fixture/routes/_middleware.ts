import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { CookieSession, handler as sessionHandler } from "fresh-session";

export type State = {
  session: CookieSession;
};

export function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  return sessionHandler(req, ctx);
}
