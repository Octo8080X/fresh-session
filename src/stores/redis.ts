import {
  deleteCookie,
  getCookies,
  MiddlewareHandlerContext,
  setCookie,
} from "../deps.ts";
import { type CookieOptions } from "./cookie_option.ts";
import { Session } from "../session.ts";

export type WithSession = {
  session: Session;
};
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
    if (session.doDelete) {
      await this.#store.del(this.key);

      deleteCookie(response.headers, "sessionId");
    } else {
      await this.#store.set(
        this.key,
        JSON.stringify({ data: session.data, _flash: session.flashedData })
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
}

export function CreateRedisSession(
  store: Store,
  keyPrefix = "session_",
  cookieOptions?: CookieOptions
) {
  const redisStore = store;

  return async function RedisSession(
    req: Request,
    ctx: MiddlewareHandlerContext<WithSession>
  ) {
    const { sessionId } = getCookies(req.headers);
    const redisSessionStorage = await createRedisSessionStorage(
      sessionId,
      redisStore,
      keyPrefix,
      cookieOptions
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
