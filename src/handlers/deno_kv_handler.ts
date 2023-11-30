import { MiddlewareHandler, MiddlewareHandlerContext } from "../../deps.ts";
import { getDenoKvSession } from "../stores/deno_kv_store.ts";
import {
  DenoKvFreshSessionOptions,
  RequiredDenoKvFreshSessionOptions,
} from "../type.ts";

const DEFAULT_DENO_KV_SESSION_OPTIONS: Omit<
  RequiredDenoKvFreshSessionOptions,
  "client"
> = {
  keyPrefix: "session",
  excludePath: [],
  baseKeyPath: [],
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

export function getDenoKvSessionHandler<T extends string, F extends string>(
  options: DenoKvFreshSessionOptions,
): MiddlewareHandler {
  return async function (
    req: Request,
    ctx: MiddlewareHandlerContext,
  ): Promise<Response> {
    const mergedOptions: RequiredDenoKvFreshSessionOptions = {
      ...DEFAULT_DENO_KV_SESSION_OPTIONS,
      ...options,
      cookieOptions: {
        ...DEFAULT_DENO_KV_SESSION_OPTIONS.cookieOptions,
        ...options.cookieOptions,
      },
    };

    if (
      mergedOptions.excludePath.includes(new URL(req.url).pathname) ||
      ctx.destination != "route"
    ) {
      return ctx.next();
    }

    const { session, sessionCookieSetter } = await getDenoKvSession<T, F>(
      req,
      mergedOptions.cookieOptions.name,
      mergedOptions.baseKeyPath,
      mergedOptions.keyPrefix,
      mergedOptions.client,
    );
    ctx.state.session = session;
    const response = await ctx.next();

    return sessionCookieSetter(response, mergedOptions.cookieOptions);
  };
}
