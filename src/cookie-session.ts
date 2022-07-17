import {
  create,
  decode,
  getCookies,
  MiddlewareHandlerContext,
  setCookie,
  verify,
} from "./deps.ts";

export function key() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("APP_KEY")),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign", "verify"],
  );
}

export type State = {
  session: CookieSession;
};

export class CookieSession {
  #id: string;
  #data = {};

  constructor(id: string, data = {}) {
    this.#id = id;
    this.#data = data;
  }

  get id() {
    return this.#id;
  }

  get data() {
    return this.#data;
  }

  set data(value) {
    this.#data = value;
  }

  static create() {
    return new this("", {});
  }

  static async exists(id: string) {
    return verify(id, await key());
  }

  static get(id: string) {
    const [, payload] = decode(id);
    return new this(id, payload as object);
  }

  async persist(response: Response) {
    setCookie(response.headers, {
      name: "sessionId",
      value: await create(
        { alg: "HS512", typ: "JWT" },
        { ...this.#data },
        await key(),
      ),
    });

    return response;
  }
}

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  const { sessionId } = getCookies(req.headers);
  if (sessionId && (await CookieSession.exists(sessionId))) {
    ctx.state.session = await CookieSession.get(sessionId);
  }

  if (!ctx.state.session) {
    ctx.state.session = new CookieSession(sessionId);
  }

  const response = await ctx.next();

  return ctx.state.session.persist(response);
}
