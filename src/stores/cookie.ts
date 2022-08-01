import {
  create,
  decode,
  getCookies,
  MiddlewareHandlerContext,
  setCookie,
  verify,
} from "../deps.ts";
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

export function createCookieSessionStorage() {
  return CookieSessionStorage.init();
}

export class CookieSessionStorage {
  #key: CryptoKey;

  constructor(key: CryptoKey) {
    this.#key = key;
  }

  static async init() {
    return new this(await key());
  }

  create() {
    return new Session();
  }

  exists(sessionId: string) {
    return verify(sessionId, this.#key).then(() => true).catch((e) => {
      console.warn("Invalid JWT token, creating new session...");
      return false;
    });
  }

  get(sessionId: string) {
    const [, payload] = decode(sessionId);
    const { _flash = {}, ...data } = payload;
    return new Session(data as object, _flash);
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
    });

    return response;
  }
}

export async function cookieSession(
  req: Request,
  ctx: MiddlewareHandlerContext<WithSession>,
) {
  const { sessionId } = getCookies(req.headers);
  const cookieSessionStorage = await createCookieSessionStorage();

  if (
    sessionId && (await cookieSessionStorage.exists(sessionId))
  ) {
    ctx.state.session = await cookieSessionStorage.get(sessionId);
  }

  if (!ctx.state.session) {
    ctx.state.session = cookieSessionStorage.create();
  }

  const response = await ctx.next();

  return cookieSessionStorage.persist(response, ctx.state.session);
}
