import type {
  Plugin,
  MiddlewareHandlerContext,
  MiddlewareHandler,
} from "../deps.ts";
import { cookieSession } from "../stores/cookie.ts";
import { CookieOptions } from "../stores/cookie_option.ts";

export type sessionModule =(req: Request, ctx: MiddlewareHandlerContext) => Promise<Response>

export function getCookieSessionHandler(session: sessionModule, excludePath: string[]): MiddlewareHandler {
  return function (req: Request, ctx: MiddlewareHandlerContext) {
    if (excludePath.includes(new URL(req.url).pathname)) {
      return ctx.next();
    }
    return session(req, ctx);
  };
}

export function getCookieSessionPlugin(path = "/", excludePath = [],  cookieOptions?: CookieOptions): Plugin {
  const session = cookieSession(cookieOptions);
  const handler = getCookieSessionHandler(session, excludePath);

  return {
    name: "cookieSessionPlugin",
    middlewares: [
      {
        middleware: {
          handler: handler,
        },
        path: path,
      },
    ],
  };
}
