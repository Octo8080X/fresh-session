import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { CreateCookieSession, WithSession } from "fresh-session";

export type State = {} & WithSession;

const cookieSession = CreateCookieSession();

export function handler(req: Request, ctx: MiddlewareHandlerContext<State>) {
  return cookieSession(req, ctx);
}
