import { CookieFreshSessionOptions } from "../type.ts";
import { getCookieSessionHandler } from "../handlers/cookie_handler.ts";

export function getCookieSessionPlugin<T extends string, F extends string>(
  middlewarePath = "/",
  options?: CookieFreshSessionOptions,
) {
  const handler = getCookieSessionHandler<T, F>(options);
  return {
    name: "CookieSessionPlugin",
    middlewares: [
      {
        middleware: {
          handler,
        },
        path: middlewarePath,
      },
    ],
  };
}
