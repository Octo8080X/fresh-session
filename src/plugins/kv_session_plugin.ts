import type {
  Plugin,
  MiddlewareHandlerContext,
  MiddlewareHandler,
} from "../deps.ts";
import { kvSession } from "../stores/kv.ts";
import { CookieOptions } from "../stores/cookie_option.ts";
import { sessionModule } from "../stores/interface.ts";

export function getKvSessionHandler(session: sessionModule, excludePath: string[]): MiddlewareHandler {
  return function (req: Request, ctx: MiddlewareHandlerContext) {
    if (excludePath.includes(new URL(req.url).pathname)) {
      return ctx.next();
    }
    return session(req, ctx);
  };
}

export function getKvSessionPlugin(storePath: string|null, path = "/", excludePath = [], cookieOptions?: CookieOptions): Plugin {
  const session = kvSession(storePath, cookieOptions);
  const handler = getKvSessionHandler(session, excludePath);

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
