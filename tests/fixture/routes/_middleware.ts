import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { handler as sessionHandler, Session } from "fresh-session";

export type State = {
  session: Session;
};

export function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  return sessionHandler(req, ctx);
}
