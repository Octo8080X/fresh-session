import { MiddlewareHandler, MiddlewareHandlerContext } from "../../deps.ts";
import { getCookieSession } from "../stores/cookie_store.ts";
import {
  CookieFreshSessionOptions,
  RequiredCookieFreshSessionOptions,
} from "../type.ts";

const DEFAULT_COOKIE_SESSION_OPTIONS: RequiredCookieFreshSessionOptions = {
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

export function getCookieSessionHandler<T extends string, F extends string>(
  options: CookieFreshSessionOptions = DEFAULT_COOKIE_SESSION_OPTIONS,
): MiddlewareHandler {
  return async function (
    req: Request,
    ctx: MiddlewareHandlerContext,
  ): Promise<Response> {
    const mergedOptions: RequiredCookieFreshSessionOptions = {
      ...DEFAULT_COOKIE_SESSION_OPTIONS,
      ...options,
      cookieOptions: {
        ...DEFAULT_COOKIE_SESSION_OPTIONS.cookieOptions,
        ...options.cookieOptions,
      },
    };

    if (
      mergedOptions.excludePath.includes(new URL(req.url).pathname) ||
      ctx.destination != "route"
    ) {
      return ctx.next();
    }

    const { session, sessionCookieSetter } = await getCookieSession<T, F>(
      req,
      mergedOptions.cookieOptions.name,
    );
    ctx.state.session = session;
    const response = await ctx.next();

    return sessionCookieSetter(response, mergedOptions.cookieOptions);
  };
}
