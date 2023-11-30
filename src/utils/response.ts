import { setCookie } from "../../deps.ts";
import { RequiredCookieOptions } from "../type.ts";
export function setSessionText(
  res: Response,
  payload: string,
  cookieOptions: RequiredCookieOptions,
): Response {
  setCookie(res.headers, {
    value: payload,
    ...cookieOptions,
  });

  return res;
}
