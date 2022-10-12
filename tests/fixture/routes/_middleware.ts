import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { createCookieSession, WithSession } from "fresh-session";

export type State = {} & WithSession;

const cookieSession = createCookieSession();

export function handler(req: Request, ctx: MiddlewareHandlerContext<State>) {
  return cookieSession(req, ctx);
}
