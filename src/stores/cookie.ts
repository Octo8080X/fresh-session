import {
  getCookies,
  MiddlewareHandlerContext,
  setCookie,
  seal,
  unseal,
  ironDefaults,
} from "../deps.ts";
import { type CookieOptions } from "./cookie_option.ts";
import { Session } from "../session.ts";
import type { WithSession } from "./interface.ts";

export function createCookieSessionStorage(cookieOptions?: CookieOptions) {
  let cookieOptionsParam = cookieOptions;
  if (!cookieOptionsParam) {
    cookieOptionsParam = {};
  }

  return CookieSessionStorage.init(cookieOptionsParam);
}

export class CookieSessionStorage {
  #cookieOptions: CookieOptions;

  constructor(cookieOptions: CookieOptions) {
    this.#cookieOptions = cookieOptions;
  }

  static init(cookieOptions: CookieOptions) {
    return new this(cookieOptions);
  }

  create() {
    return new Session();
  }

  exists(sessionId: string) {
    return unseal(globalThis.crypto, sessionId, Deno.env.get('APP_KEY') as string, ironDefaults)
      .then(() => true)
      .catch((e) => {
        console.warn("Invalid session, creating new session...");
        return false;
      });
  }

  async get(sessionId: string) {
    const decryptedData = await unseal(globalThis.crypto, sessionId, Deno.env.get('APP_KEY') as string, ironDefaults)

    const { _flash = {}, ...data } = decryptedData;
    return new Session(data as object, _flash);
  }

  async persist(response: Response, session: Session) {
    if (session.doKeyRotate) {
      this.keyRotate();
    }

    const encryptedData = await seal(globalThis.crypto, { ...session.data, _flash: session.flashedData }, Deno.env.get('APP_KEY') as string, ironDefaults)

    setCookie(response.headers, {
      name: "sessionId",
      value: encryptedData,
      path: "/",
      ...this.#cookieOptions,
    });

    return response;
  }
  /**
   * Does not work in cookie sessions.
   */
  keyRotate() {
    console.warn(
      "%c*****************************************************\n* '.keyRotate' is not supported for cookie sessions *\n*****************************************************",
      "color: yellow;",
    );
  }
}

export function cookieSession(cookieOptions?: CookieOptions) {
  return async function (
    req: Request,
    ctx: MiddlewareHandlerContext,
  ): Promise<Response> {
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
