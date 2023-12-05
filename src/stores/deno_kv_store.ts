import { getSessionPayloadFromCookie } from "../utils/request.ts";
import { createSession } from "../session.ts";
import {
  FlashData,
  RequiredCookieOptions,
  Session,
  SessionData,
  SessionDuplicationData,
  SessionFromDenoKV,
} from "../type.ts";
import { setSessionText } from "../utils/response.ts";

async function sessionDataFromDenoKv<T extends string, F extends string>(
  sessionKey: string,
  baseKeyPath: string[],
  client: Deno.Kv,
): Promise<{ session: SessionData<T>; flash: FlashData<F> }> {
  const { ["value"]: payload } = await client.get<string>([
    ...baseKeyPath,
    sessionKey,
  ]);

  if (!payload) {
    return { session: {}, flash: {} };
  }

  const { session, flash } = JSON.parse(payload);

  return { session: session || {}, flash: flash || {} };
}

async function jsonFromSessionData<
  T extends string,
  F extends string,
>(rawPayload: { session: SessionData<T>; flash: FlashData<F> }) {
  return await JSON.stringify(rawPayload);
}

function rotateKey(prefix: string) {
  return createSessionKey(prefix);
}

function getSessionCookieSetterFunction<T extends string, F extends string>(
  getDuplicateDataFunction: { (): SessionDuplicationData<T, F> },
  sessionKey: string,
  baseKeyPath: string[],
  prefix: string,
  client: Deno.Kv,
) {
  return async function (res: Response, cookieOptions: RequiredCookieOptions) {
    const { operations, ...rawPayload } = getDuplicateDataFunction();

    const payload = await jsonFromSessionData(rawPayload);

    let newSessionKey = operations.doRotateKey ? rotateKey(prefix) : sessionKey;
    newSessionKey = operations.doDestroy ? "" : newSessionKey;
    const newCookieOptions = operations.doDestroy
      ? { ...cookieOptions, maxAge: 0 }
      : cookieOptions;

    if (operations.doRotateKey || operations.doDestroy) {
      await client.delete([...baseKeyPath, sessionKey]);
    }

    if (!operations.doDestroy) {
      await client.set([...baseKeyPath, newSessionKey], payload, {expireIn: 0});
    }

    return setSessionText(res, newSessionKey, newCookieOptions);
  };
}

function createSessionKey(prefix: string): string {
  return `${prefix}${crypto.randomUUID()}`;
}

export async function getDenoKvSession<T extends string, F extends string>(
  req: Request,
  cookieName: string,
  baseKeyPath: string[],
  keyPrefix: string,
  client: Deno.Kv,
): Promise<{
  session: Session<T, F>;
  sessionCookieSetter: {
    (
      res: Response,
      cookieOptions: RequiredCookieOptions,
    ): Response | Promise<Response>;
  };
}> {
  const sessionKey = getSessionPayloadFromCookie(req, cookieName);

  if (!sessionKey) {
    const { session, getDuplicateDataFunction } = createSession<T, F>({
      session: {},
      flash: {},
    });

    const newSessionKey = createSessionKey(keyPrefix);

    const sessionCookieSetter = getSessionCookieSetterFunction(
      getDuplicateDataFunction,
      newSessionKey,
      baseKeyPath,
      keyPrefix,
      client,
    );
    return { session, sessionCookieSetter };
  }

  const src = await sessionDataFromDenoKv(sessionKey, baseKeyPath, client);
  const { session, getDuplicateDataFunction } = createSession<T, F>(src);

  const sessionCookieSetter = getSessionCookieSetterFunction(
    getDuplicateDataFunction,
    sessionKey,
    baseKeyPath,
    keyPrefix,
    client,
  );

  return {
    session,
    sessionCookieSetter,
  };
}
