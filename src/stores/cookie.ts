import {
  create,
  decode,
  getCookies,
  MiddlewareHandlerContext,
  setCookie,
  verify,
} from "../deps.ts";
import { type CookieOptions } from "./cookie_option.ts";
import { Session } from "../session.ts";

export function key() {
  const key = Deno.env.get("APP_KEY");

  if (!key) {
    console.warn(
      "[FRESH SESSION] Warning: We didn't detect a env variable `APP_KEY`, if you are in production please fix this ASAP to avoid any security issue.",
    );
  }

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key || "not-secret"),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign", "verify"],
  );
}

export type WithSession = {
  session: Session;
};

export function createCookieSessionStorage(cookieOptions?: CookieOptions) {
  let cookieOptionsParam = cookieOptions;
  if (!cookieOptionsParam) {
    cookieOptionsParam = {};
  }

  return CookieSessionStorage.init(cookieOptionsParam);
}

export class CookieSessionStorage {
  #key: CryptoKey;
  #cookieOptions: CookieOptions;

  constructor(key: CryptoKey, cookieOptions: CookieOptions) {
    this.#key = key;
    this.#cookieOptions = cookieOptions;
  }

  static async init(cookieOptions: CookieOptions) {
    return new this(await key(), cookieOptions);
  }

  create() {
    return new Session();
  }

  exists(sessionId: string) {
    return verify(sessionId, this.#key)
      .then(() => true)
      .catch((_) => {
        console.warn("Invalid JWT token, creating new session...");
        return false;
      });
  }

  get(sessionId: string) {
    const [, payload] = decode(sessionId);
    const { _flash = {}, ...data } = payload as {
      _flash: Record<string, unknown>;
    };
    return new Session(data as Record<string, unknown>, _flash);
  }

  async persist(response: Response, session: Session) {
    setCookie(response.headers, {
      name: "sessionId",
      value: await create(
        { alg: "HS512", typ: "JWT" },
        { ...session.data, _flash: session.flashedData },
        this.#key,
      ),
      path: "/",
      ...this.#cookieOptions,
    });

    return response;
  }
}

export function cookieSession(cookieOptions?: CookieOptions) {
  return async function (
    req: Request,
    ctx: MiddlewareHandlerContext<WithSession>,
  ) {
    const { sessionId } = getCookies(req.headers);
    const cookieSessionStorage = await createCookieSessionStorage(
      cookieOptions,
    );

    if (sessionId && (await cookieSessionStorage.exists(sessionId))) {
      ctx.state.session = await cookieSessionStorage.get(sessionId);
    }

    if (!ctx.state.session) {
      ctx.state.session = cookieSessionStorage.create();
    }

    const response = await ctx.next();

    return cookieSessionStorage.persist(response, ctx.state.session);
  };
}
