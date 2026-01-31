// Cookie操作関連
import {
  type Cookie,
  deleteCookie,
  getCookies,
  setCookie,
} from "@std/http/cookie";

/**
 * Cookie操作ユーティリティ
 */
export function setSessionCookie(
  headers: Headers,
  name: string,
  value: string,
  options: Partial<Cookie> = {},
) {
  setCookie(headers, {
    name,
    value,
    path: options.path ?? "/",
    httpOnly: options.httpOnly ?? true,
    secure: options.secure ?? true,
    sameSite: options.sameSite ?? "Lax",
    maxAge: options.maxAge,
    expires: options.expires,
    domain: options.domain,
  });
}

export function getSessionIdFromCookie(
  reqHeaders: Headers,
  name: string,
): string | undefined {
  const cookies = getCookies(reqHeaders);
  return cookies[name];
}

export function deleteSessionCookie(headers: Headers, name: string) {
  deleteCookie(headers, name, { path: "/" });
}

export { getCookies };
