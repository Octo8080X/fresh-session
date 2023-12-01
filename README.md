# Fresh Session 🍋

Dead simple cookie-based session for [Deno Fresh](https://fresh.deno.dev).

## Get started

Fresh Session provides plug-ins that add Session functionality.

## Install / Import

You can import Fresh Session like so:

```ts
import {
  getCookieSessionPlugin,
  getRedisSessionPlugin,
  getDenoKvSessionPlugin
  type CookieFreshSessionOptions,
  type DenoKvFreshSessionOptions,
  type RedisFreshSessionOptions,
  type Session,
  type WithSession,
} from "https://deno.land/x/fresh_session@beta-0.3.0/mod.ts";
```

## Usage

### JWT-based Cookie Session

```ts
// fresh.config.ts
import { defineConfig } from "$fresh/server.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";

import { getCookieSessionPlugin } from "../fresh-session-next/mod.ts";

export default defineConfig({
  plugins: [
    twindPlugin(twindConfig),
    getCookieSessionPlugin("/"),
  ],
});
```

**⚠ Setup secret key**

Fresh Session currently uses [JSON Web Token](https://jwt.io/) under the hood to
create and manage session in the cookies.

JWT requires a secret key to sign new tokens. Fresh Session uses the secret key
from your [environment variable](https://deno.land/std/dotenv/load.ts)
`APP_SESSION_CRYPTO_KEY`.

### Sessions using Redis as the backend

```ts
// fresh.config.ts
import { defineConfig } from "$fresh/server.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";

import { getRedisSessionPlugin } from "../fresh-session-next/mod.ts";

// any redis client. ex. ioredis-mock, redis, upstash-redis
import Redis from "https://unpkg.com/ioredis-mock";
const redis = new Redis();

export default defineConfig({
  plugins: [
    twindPlugin(twindConfig),
    getRedisSessionPlugin("/", { client: redis }),
  ],
});
```

### Sessions using Deno.KV as the backend

```ts
// fresh.config.ts
import { defineConfig } from "$fresh/server.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";

import { getDenoKvSessionPlugin } from "../fresh-session-next/mod.ts";

export default defineConfig({
  plugins: [
    twindPlugin(twindConfig),
    getDenoKvSessionPlugin("/", { client: await Deno.openKv(":memory:") }),
  ],
});
```

### Interact with the session in your routes

Now that the middleware is setup, it's going to handle creating/resolving
session based on the request cookie. So all that you need to worry about is
interacting with your session.

```tsx
// ./routes/dashboard.tsx
import { Handlers, PageProps } from "$fresh/server.ts";
import type { WithSession } from "https://deno.land/x/fresh_session@beta-0.3.0/mod.ts";

export const handler: Handlers<
  unknown,
  WithSession<"KEY_A" | "KEY_B" | "KEY_C", "success">
> = {
  GET(_req, ctx) {
    // The session is accessible via the `ctx.state`
    const { session } = ctx.state;

    // Session methods
    // Set session value set.
    session.set("KEY_A", "SESSION-DATA");
    // get session value.
    session.get("KEY_A");
    // Verify session key registration status.
    session.has("KEY_A");
    // Session value delete.
    session.delete("KEY_A");
    // Get session values all.
    session.list();
    // Session values clear.
    session.clear();

    // Session operation methods
    // Destroy session key and data.
    session.destroy();
    // Session key rotate.
    session.rotateKey();

    // Flash method
    // The data set in flash can be used for the next access.
    session.flash("success", "Successfully flashed a message!");
    session.flash("success");
    // If you want to use the set value in the access, use 'flashNow'.
    session.flashNow("success");

    return ctx.render();
  },
};

export default function Dashboard(
  props: PageProps<
    unknown,
    WithSession<"KEY_A" | "KEY_B" | "KEY_C", "success">
  >,
) {
  return <div>Session Data [KEY_A]: {props.state.session.get("KEY_A")}</div>;
}
```

## Usage Cookie Options

session value is cookie. can set the option for cookie.

```ts
import { PartialCookieOptions } from "https://deno.land/x/fresh_session@beta-0.3.0/mod.ts";

// type PartialCookieOptions = {
//   maxAge?: number | undefined;
//   domain?: string | undefined;
//   path?: string | undefined;
//   secure?: boolean | undefined;
//   httpOnly?: boolean | undefined;
//   sameSite?: "Strict" | "Lax" | "None" | undefined;
// }

import { defineConfig } from "$fresh/server.ts";
import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";

import { getDenoKvSessionPlugin } from "[../fresh-session-next/mod.ts](https://deno.land/x/fresh_session@beta-0.3.0/mod.ts)";

export default defineConfig({
  plugins: [
    twindPlugin(twindConfig),
    getDenoKvSessionPlugin("/", {
      client: await Deno.openKv(":memory:"),
      cookieOptions: { maxAge: 60 * 10 },
    }),
  ],
});
```

## Credit

Initial work done by [@xstevenyung](https://github.com/xstevenyung)

Inspiration taken from [Oak Sessions](https://github.com/jcs224/oak_sessions) &
thanks to [@jcs224](https://github.com/jcs224) for all the insight!
