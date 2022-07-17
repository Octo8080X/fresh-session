import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { cookieSession, Session } from "fresh-session";

export type State = {
  session: Session;
};

export function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  return cookieSession(req, ctx);
}
