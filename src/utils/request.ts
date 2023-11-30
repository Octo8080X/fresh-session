import { getCookies } from "../../deps.ts";
//export function getSessionText(req: Request): string | null {
//  const { sessionText } = getCookies(req.headers);
//  return sessionText;
//}

export function getSessionPayloadFromCookie(
  req: Request,
  cookieName: string,
): string | null {
  const { [cookieName]: sessionPayload } = getCookies(req.headers);
  return sessionPayload;
}
