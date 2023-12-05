import { getSessionPayloadFromCookie } from "../utils/request.ts";
import { createSession } from "../session.ts";
import { jwtCreate, jwtVerify } from "../../deps.ts";
import {
  FlashData,
  RequiredCookieOptions,
  Session,
  SessionData,
  SessionDuplicationData,
} from "../type.ts";
import { setSessionText } from "../utils/response.ts";

export function getCryptokey() {
  const key = Deno.env.get("APP_SESSION_CRYPTO_KEY");

  if (!key) {
    console.warn(
      "[FRESH SESSION] Warning: We didn't detect a env variable `APP_SESSION_CRYPTO_KEY`, if you are in production please fix this ASAP to avoid any security issue.",
    );
  }

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key || "not-secret"),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign", "verify"],
  );
}

async function sessionDataFromJwt<T extends string, F extends string>(
  src: string,
  cryptoKey: CryptoKey,
): Promise<{ session: SessionData<T>; flash: FlashData<F> }> {
  try {
    const payload = await jwtVerify(src, cryptoKey);
    const { session, flash } = payload;
    return { session: session || {}, flash: flash || {} };
  } catch (e) {
    console.error(e);
    console.error("Invalid JWT token, creating new session...");
    return { session: {}, flash: {} };
  }
}

async function jwtFromSessionData<T extends string, F extends string>(
  rawPayload: { session: SessionData<T>; flash: FlashData<F> },
  cryptoKey: CryptoKey,
) {
  return await jwtCreate({ alg: "HS512", typ: "JWT" }, rawPayload, cryptoKey);
}

function rotateKey() {
  console.warn(
    "%c*****************************************************\n* '.keyRotate' is not supported for cookie sessions *\n*****************************************************",
    "color: yellow;",
  );
}

function getSessionCookieSetterFunction<T extends string, F extends string>(
  getDuplicateDataFunction: { (): SessionDuplicationData<T, F> },
  cryptoKey: CryptoKey,
) {
  return async function (res: Response, cookieOptions: RequiredCookieOptions) {
    const { operations, ...rawPayload } = getDuplicateDataFunction();

    const payload = await jwtFromSessionData(rawPayload, cryptoKey);

    if (operations.doRotateKey) {
      rotateKey();
    }

    if (operations.doDestroy) {
      return setSessionText(res, "", { ...cookieOptions, maxAge: 0 });
    }

    return setSessionText(res, payload, cookieOptions);
  };
}

export async function getCookieSession<T extends string, F extends string>(
  req: Request,
  cookieName: string,
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
  const cryptoKey = await getCryptokey();

  const sessionText = getSessionPayloadFromCookie(req, cookieName);

  if (!sessionText) {
    const { session, getDuplicateDataFunction } = createSession<T, F>({
      session: {},
      flash: {},
    });
    const sessionCookieSetter = getSessionCookieSetterFunction(
      getDuplicateDataFunction,
      cryptoKey,
    );
    return { session, sessionCookieSetter };
  }

  const src = await sessionDataFromJwt(sessionText, cryptoKey);
  const { session, getDuplicateDataFunction } = createSession<T, F>(src);

  const sessionCookieSetter = getSessionCookieSetterFunction(
    getDuplicateDataFunction,
    cryptoKey,
  );

  return {
    session,
    sessionCookieSetter,
  };
}
