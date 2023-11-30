import { type Cookie } from "../deps.ts";

export type AllowType = object | string | number | boolean;
export type SessionData<T extends string> = {
  [key in T]?: AllowType;
};

export type FlashData<F extends string> = {
  [key in F]?: AllowType;
};

export type SessionOperations = {
  doDestroy: boolean;
  doRotateKey: boolean;
};

export type SessionDuplicationData<T extends string, F extends string> = {
  session: SessionData<T>;
  flash: FlashData<F>;
  operations: SessionOperations;
};

export interface SessionFromDenoKV {
  session: SessionData<string>;
  flash: FlashData<string>;
}

export type Session<T extends string, F extends string> = {
  get: { (key: T): SessionData<T>[T] };
  set: { (key: T, value: AllowType): void };
  delete: { (key: T): void };
  list: { (): SessionData<T> };
  destroy: { (): void };
  rotateKey: { (): void };
  has: { (key: T): boolean };
  clear: { (): void };
  flash: { (key: F): FlashData<F>[F]; (key: F, value: AllowType): void };
  flashNow: { (key: F): AllowType };
  getRawData: { (): SessionDuplicationData<T, F> };
};

export type CookieOptions = Omit<
  Cookie,
  "value" | "expires" | "name" | "unparsed"
>;
export type PartialCookieOptions = Partial<CookieOptions>;
export type RequiredCookieOptions = Required<CookieOptions & { name: string }>;

// NOTE: USAGE: HandlerContext<unknown, withSession<"count"|"message", "error">>
export type WithSession<T extends string, F extends string> = {
  session: Session<T, F>;
};

export interface FreshSessionBaseOptions {
  cookieOptions?: PartialCookieOptions;
  excludePath?: string[];
}

export type CookieFreshSessionOptions = FreshSessionBaseOptions

export interface RequiredCookieFreshSessionOptions
  extends Required<CookieFreshSessionOptions> {
  cookieOptions: RequiredCookieOptions;
}

interface redisSetOptions {
  ex?: number;
}

export interface RedisClient {
  set: {
    (
      key: string,
      value: string,
      redisOptions: redisSetOptions,
    ): Promise<void> | void;
  };
  get: { (key: string): Promise<string | null> };
  del: { (key: string): Promise<void> | void };
}

export interface RedisFreshSessionOptions extends FreshSessionBaseOptions {
  client: RedisClient;
  keyPrefix?: string;
}

export interface RequiredRedisFreshSessionOptions
  extends Required<RedisFreshSessionOptions> {
  cookieOptions: RequiredCookieOptions;
}

export interface DenoKvFreshSessionOptions extends FreshSessionBaseOptions {
  client: Deno.Kv;
  keyPrefix?: string;
  baseKeyPath?: string[];
}

export interface RequiredDenoKvFreshSessionOptions
  extends Required<DenoKvFreshSessionOptions> {
  cookieOptions: RequiredCookieOptions;
}
