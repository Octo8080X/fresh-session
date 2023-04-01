import { type Cookie } from "../deps.ts";

export type CookieOptions = Omit<Cookie, "name" | "value">;
export type CookieWithRedisOptions = CookieOptions & { keyPrefix?: string };
