import { MiddlewareHandler, MiddlewareHandlerContext } from "../../deps.ts";
import { getRedisSession } from "../stores/redis_store.ts";
import {
  RedisFreshSessionOptions,
  RequiredRedisFreshSessionOptions,
} from "../type.ts";

const DEFAULT_REDIS_SESSION_OPTIONS: Omit<
  RequiredRedisFreshSessionOptions,
  "client"
> = {
  keyPrefix: "session",
  excludePath: [],
  cookieOptions: {
    name: "session",
    path: "/",
    maxAge: 60 * 60 * 24,
    sameSite: "Lax",
    secure: true,
    httpOnly: true,
    domain: "",
  },
};

export function getRedisSessionHandler<T extends string, F extends string>(
  options: RedisFreshSessionOptions,
): MiddlewareHandler {
  return async function (
    req: Request,
    ctx: MiddlewareHandlerContext,
  ): Promise<Response> {
    const mergedOptions: RequiredRedisFreshSessionOptions = {
      ...DEFAULT_REDIS_SESSION_OPTIONS,
      ...options,
      cookieOptions: {
        ...DEFAULT_REDIS_SESSION_OPTIONS.cookieOptions,
        ...options.cookieOptions,
      },
    };

    if (
      mergedOptions.excludePath.includes(new URL(req.url).pathname) ||
      ctx.destination != "route"
    ) {
      return ctx.next();
    }

    const { session, sessionCookieSetter } = await getRedisSession<T, F>(
      req,
      mergedOptions.cookieOptions.name,
      mergedOptions.keyPrefix,
      mergedOptions.client,
    );
    ctx.state.session = session;
    const response = await ctx.next();

    return sessionCookieSetter(response, mergedOptions.cookieOptions);
  };
}
