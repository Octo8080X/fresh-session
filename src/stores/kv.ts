import {
  deleteCookie,
  getCookies,
  MiddlewareHandlerContext,
  setCookie,
} from "../deps.ts";
import { type CookieOptions, CookieWithRedisOptions } from "./cookie_option.ts";
import { Session } from "../session.ts";
import type { WithSession } from "./interface.ts";

export function createKvSessionStorage(
  sessionId: string,
  store: Deno.Kv,
  keyPrefix: string,
  cookieOptions?: CookieOptions,
) {
  let cookieOptionsParam = cookieOptions;
  if (!cookieOptionsParam) {
    cookieOptionsParam = {};
  }

  return KvSessionStorage.init(
    sessionId,
    store,
    keyPrefix,
    cookieOptionsParam,
  );
}

export class KvSessionStorage {
  #sessionKey: string;
  #keyPrefix: string;
  #store: Deno.Kv;
  #cookieOptions: CookieOptions;
  constructor(
    key: string,
    store: Deno.Kv,
    keyPrefix: string,
    cookieOptions: CookieOptions,
  ) {
    this.#sessionKey = key;
    this.#store = store;
    this.#keyPrefix = keyPrefix;
    this.#cookieOptions = cookieOptions;
  }

  static init(
    sessionKey: string | undefined,
    store: Deno.Kv,
    keyPrefix: string,
    cookieOptions: CookieOptions,
  ) {
    let key = !sessionKey ? crypto.randomUUID() : sessionKey;

    return new this(key, store, keyPrefix, cookieOptions);
  }

  get key() {
    return `${this.#keyPrefix}${this.#sessionKey}`;
  }

  create() {
    return new Session();
  }

  async exists(): Promise<boolean> {
    return !(await this.#store.get(["fresh-session", this.key]).value);
  }

  async get() {
    const { _flash = {}, data } = {
      ...(await this.#store.get(["fresh-session", this.key])).value,
    };

    return new Session(data as object, _flash);
  }

  async persist(response: Response, session: Session) {
    if (session.doKeyRotate) {
      this.keyRotate();
    }

    if (session.doDelete) {
      await this.#store.delete(["fresh-session", this.key]);

      deleteCookie(response.headers, "sessionId");
    } else {
      let redisOptions: { ex?: number } = {};

      if (this.#cookieOptions?.maxAge) {
        redisOptions.ex = this.#cookieOptions.maxAge;
      }
      if (this.#cookieOptions?.expires) {
        redisOptions.ex = Math.round(
          ((this.#cookieOptions?.expires).getTime() - new Date().getTime()) /
            1000,
        );
      }

      await this.#store.set(
        ["fresh-session", this.key],
        { data: session.data, _flash: session.flashedData },
        redisOptions,
      );

      setCookie(response.headers, {
        name: "sessionId",
        value: this.#sessionKey,
        path: "/",
        ...this.#cookieOptions,
      });
    }

    return response;
  }
  keyRotate() {
    this.#sessionKey = crypto.randomUUID();
  }
}

function hasKeyPrefix(
  cookieWithRedisOptions: any,
): cookieWithRedisOptions is { keyPrefix: string } {
  if (!cookieWithRedisOptions) return false;
  if (typeof cookieWithRedisOptions !== "object") return false;
  if (!cookieWithRedisOptions.keyPrefix) return false;
  if (typeof cookieWithRedisOptions.keyPrefix !== "string") return false;
  return true;
}

export function kvSession(
  storePath: string|null,
  cookieWithRedisOptions?: CookieWithRedisOptions,
) {
  let setupKeyPrefix = "session_";
  let setupCookieOptions = cookieWithRedisOptions;

  if (hasKeyPrefix(cookieWithRedisOptions)) {
    const { keyPrefix, ...cookieOptions } = cookieWithRedisOptions;
    setupKeyPrefix = keyPrefix;
    setupCookieOptions = cookieOptions;
  }

  return async function (
    req: Request,
    ctx: MiddlewareHandlerContext,
  ) {
    const { sessionId } = getCookies(req.headers);

    const kvStore = await Deno.openKv(storePath);
    const kvSessionStorage = await createKvSessionStorage(
      sessionId,
      kvStore,
      setupKeyPrefix,
      setupCookieOptions,
    );

    if (sessionId && (await kvSessionStorage.exists())) {
      ctx.state.session = await kvSessionStorage.get();
    }

    if (!ctx.state.session) {
      ctx.state.session = kvSessionStorage.create();
    }
    const response = await ctx.next();

    const persistedResponse = await kvSessionStorage.persist(
      response,
      ctx.state.session,
    );

    await kvStore.close();

    return persistedResponse;
  };
}
