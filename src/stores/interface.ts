import { MiddlewareHandlerContext } from "../deps.ts";
import { Session } from "../session.ts";
export type WithSession = {
  session: Session;
};

export type sessionModule =(req: Request, ctx: MiddlewareHandlerContext) => Promise<Response>
