import { DenoKvFreshSessionOptions } from "../type.ts";
import { getDenoKvSessionHandler } from "../handlers/deno_kv_handler.ts";

export function getDenoKvSessionPlugin<T extends string, F extends string>(
  middlewarePath = "/",
  options: DenoKvFreshSessionOptions,
) {
  const handler = getDenoKvSessionHandler<T, F>(options);
  return {
    name: "RedisSessionPlugin",
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
