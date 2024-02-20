import { CookieFreshSessionOptions } from "../type.ts";
import { getCookieSessionHandler } from "../handlers/cookie_handler.ts";
import { Plugin } from "../../deps.ts";

export function getCookieSessionPlugin<T extends string, F extends string>(
  middlewarePath = "/",
  options?: CookieFreshSessionOptions,
): Plugin<Record<string, unknown>> {
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
