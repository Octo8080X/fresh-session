import type {
  Plugin,
  MiddlewareHandlerContext,
  MiddlewareHandler,
} from "../deps.ts";
import { Store, redisSession } from "../stores/redis.ts";
import { CookieOptions } from "../stores/cookie_option.ts";

export type sessionModule =(req: Request, ctx: MiddlewareHandlerContext) => Promise<Response>

export function getRedisSessionHandler(session: sessionModule, excludePath: string[]): MiddlewareHandler {
  return function (req: Request, ctx: MiddlewareHandlerContext) {
    if (excludePath.includes(new URL(req.url).pathname)) {
      return ctx.next();
    }
    return session(req, ctx);
  };
}

export function getRedisSessionPlugin(store: Store, path = "/", excludePath = [],  cookieOptions?: CookieOptions): Plugin {
  const session = redisSession(store, cookieOptions);
  const handler = getRedisSessionHandler(session, excludePath);

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
