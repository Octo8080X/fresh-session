import { getCookies } from "../../deps.ts";

export function getSessionPayloadFromCookie(
  req: Request,
  cookieName: string,
): string | null {
  const { [cookieName]: sessionPayload } = getCookies(req.headers);
  return sessionPayload;
}
