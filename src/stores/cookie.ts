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
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("APP_KEY")),
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
    return verify(sessionId, this.#key);
  }

  get(sessionId: string) {
    const [, payload] = decode(sessionId);
    return new Session(payload as object);
  }

  async persist(response: Response, session: Session) {
    setCookie(response.headers, {
      name: "sessionId",
      value: await create(
        { alg: "HS512", typ: "JWT" },
        { ...session.data },
        this.#key,
      ),
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
