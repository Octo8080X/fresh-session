import { RedisFreshSessionOptions } from "../type.ts";
import { getRedisSessionHandler } from "../handlers/redis_handler.ts";

export function getRedisSessionPlugin<T extends string, F extends string>(
  middlewarePath = "/",
  options: RedisFreshSessionOptions,
) {
  const handler = getRedisSessionHandler<T, F>(options);
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
