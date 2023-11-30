import { getSessionPayloadFromCookie } from "../utils/request.ts";
import { createSession } from "../session.ts";
import {
  FlashData,
  RedisClient,
  RequiredCookieOptions,
  Session,
  SessionData,
  SessionDuplicationData,
} from "../type.ts";
import { setSessionText } from "../utils/response.ts";

async function sessionDataFromRedis<T extends string, F extends string>(
  sessionKey: string,
  client: RedisClient,
): Promise<{ session: SessionData<T>; flash: FlashData<F> }> {
  const payload = await client.get(sessionKey);

  if (!payload) {
    return { session: {}, flash: {} };
  }

  const { session, flash } = JSON.parse(payload);

  return { session: session || {}, flash: flash || {} };
}

async function jsonFromSessionData<T extends string, F extends string>(
  rawPayload: { session: SessionData<T>; flash: FlashData<F> },
) {
  return await JSON.stringify(rawPayload);
}

function rotateKey(prefix: string) {
  return createSessionKey(prefix);
}

function getSessionCookieSetterFunction<T extends string, F extends string>(
  getDuplicateDataFunction: { (): SessionDuplicationData<T, F> },
  sessionKey: string,
  prefix: string,
  client: RedisClient,
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
      await client.del(sessionKey);
    }

    if (!operations.doDestroy) {
      await client.set(newSessionKey, payload, { ex: cookieOptions.maxAge });
    }

    return setSessionText(res, newSessionKey, newCookieOptions);
  };
}

function createSessionKey(prefix: string): string {
  return `${prefix}${crypto.randomUUID()}`;
}

export async function getRedisSession<T extends string, F extends string>(
  req: Request,
  cookieName: string,
  keyPrefix: string,
  client: RedisClient,
): Promise<
  {
    session: Session<T, F>;
    sessionCookieSetter: {
      (
        res: Response,
        cookieOptions: RequiredCookieOptions,
      ): Response | Promise<Response>;
    };
  }
> {
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
      keyPrefix,
      client,
    );
    return { session, sessionCookieSetter };
  }

  const src = await sessionDataFromRedis(sessionKey, client);
  const { session, getDuplicateDataFunction } = createSession<T, F>(src);

  const sessionCookieSetter = getSessionCookieSetterFunction(
    getDuplicateDataFunction,
    sessionKey,
    keyPrefix,
    client,
  );

  return {
    session,
    sessionCookieSetter,
  };
}
