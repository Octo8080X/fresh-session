import {
  deleteCookie,
  getCookies,
  MiddlewareHandlerContext,
  setCookie,
} from "../deps.ts";
import { type CookieOptions, CookieWithRedisOptions } from "./cookie_option.ts";
import { Session } from "../session.ts";
import type { WithSession } from "./interface.ts";

interface Store {
  set: Function;
  get: Function;
  del: Function;
}

export function createRedisSessionStorage(
  sessionId: string,
  store: Store,
  keyPrefix: string,
  cookieOptions?: CookieOptions
) {
  let cookieOptionsParam = cookieOptions;
  if (!cookieOptionsParam) {
    cookieOptionsParam = {};
  }

  return RedisSessionStorage.init(
    sessionId,
    store,
    keyPrefix,
    cookieOptionsParam
  );
}

export class RedisSessionStorage {
  #sessionKey: string;
  #keyPrefix: string;
  #store: Store;
  #cookieOptions: CookieOptions;
  constructor(
    key: string,
    store: Store,
    keyPrefix: string,
    cookieOptions: CookieOptions
  ) {
    this.#sessionKey = key;
    this.#store = store;
    this.#keyPrefix = keyPrefix;
    this.#cookieOptions = cookieOptions;
  }

  static init(
    sessionKey: string | undefined,
    store: Store,
    keyPrefix: string,
    cookieOptions: CookieOptions
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
    return !!(await this.#store.get(this.key));
  }

  async get() {
    const { _flash = {}, data } = JSON.parse(await this.#store.get(this.key));
    return new Session(data as object, _flash);
  }

  async persist(response: Response, session: Session) {
    if (session.doKeyRotate) {
      this.keyRotate();
    }

    if (session.doDelete) {
      await this.#store.del(this.key);

      deleteCookie(response.headers, "sessionId");
    } else {
      let redisOptions: { ex?: number } = {};

      if (this.#cookieOptions?.maxAge) {
        redisOptions.ex = this.#cookieOptions.maxAge;
      }
      if (this.#cookieOptions?.expires) {
        redisOptions.ex = Math.round(
          ((this.#cookieOptions?.expires).getTime() - new Date().getTime()) /
            1000
        );
      }

      await this.#store.set(
        this.key,
        JSON.stringify({ data: session.data, _flash: session.flashedData }),
        redisOptions
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
  keyRotate(){
    this.#sessionKey = crypto.randomUUID()
  }
}

function hasKeyPrefix(
  cookieWithRedisOptions: any
): cookieWithRedisOptions is { keyPrefix: string } {
  if (!cookieWithRedisOptions) return false;
  if (typeof cookieWithRedisOptions !== "object") return false;
  if (!cookieWithRedisOptions.keyPrefix) return false;
  if (typeof cookieWithRedisOptions.keyPrefix !== "string") return false;
  return true;
}

export function redisSession(
  store: Store,
  cookieWithRedisOptions?: CookieWithRedisOptions
) {
  const redisStore = store;

  let setupKeyPrefix = "session_";
  let setupCookieOptions = cookieWithRedisOptions;

  if (hasKeyPrefix(cookieWithRedisOptions)) {
    const { keyPrefix, ...cookieOptions } = cookieWithRedisOptions;
    setupKeyPrefix = keyPrefix;
    setupCookieOptions = cookieOptions;
  }

  return async function (
    req: Request,
    ctx: MiddlewareHandlerContext<WithSession>
  ) {
    const { sessionId } = getCookies(req.headers);
    const redisSessionStorage = await createRedisSessionStorage(
      sessionId,
      redisStore,
      setupKeyPrefix,
      setupCookieOptions
    );

    if (sessionId && (await redisSessionStorage.exists())) {
      ctx.state.session = await redisSessionStorage.get();
    }

    if (!ctx.state.session) {
      ctx.state.session = redisSessionStorage.create();
    }
    const response = await ctx.next();

    return redisSessionStorage.persist(response, ctx.state.session);
  };
}
