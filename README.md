# Fresh Session 🍋

Dead simple cookie-based session for [Deno Fresh](https://fresh.deno.dev).

## Get started

Fresh Session comes with a simple middleware to add at the root of your project,
which will create or resolve a session from the request cookie.

### Install / Import

You can import Fresh Session like so:

```ts
import {
  cookieSession,
  createCookieSessionStorage,
  CookieSessionStorage,
  WithSession,
  Session,
} from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
```

### Setup secret key

Fresh Session currently uses [JSON Web Token](https://jwt.io/) under the hood to
create and manage session in the cookies.

JWT requires a secret key to sign new tokens. Fresh Session uses the
secret key from your [environment variable](https://deno.land/std/dotenv/load.ts)
`APP_KEY`.

If you don't know how to setup environment variable locally, I wrote
[an article about .env file in Deno Fresh](https://xstevenyung.com/blog/read-.env-file-in-deno-fresh).

### Create a root middleware (`./routes/_middleware.ts`)

```ts
import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { cookieSession, WithSession } from "fresh-session";

export type State = {} & WithSession;

const session = cookieSession();

function sessionHandler(req: Request, ctx: MiddlewareHandlerContext<State>) {
  return session(req, ctx);
}
export const handler = [sessionHandler];
```

Learn more about
[Fresh route middleware](https://fresh.deno.dev/docs/concepts/middleware).

### Interact with the session in your routes

Now that the middleware is setup, it's going to handle creating/resolving
session based on the request cookie. So all that you need to worry about is
interacting with your session.

```tsx
// ./routes/dashboard.tsx
/** @jsx h */
import { h } from "preact";
import { Handlers, PageProps } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

export type Data = { session: Record<string, string> };

export const handler: Handlers<
  Data,
  WithSession // indicate with Typescript that the session is in the `ctx.state`
> = {
  GET(_req, ctx) {
    // The session is accessible via the `ctx.state`
    const { session } = ctx.state;

    // Access data stored in the session
    session.get("email");
    // Set new value in the session
    session.set("email", "hello@deno.dev");
    // returns `true` if the session has a value with a specific key, else `false`
    session.has("email");
    // clear all the session data
    session.clear();
    // Access all session data value as an object
    session.data;
    // Add flash data which will disappear after accessing it
    session.flash("success", "Successfully flashed a message!");
    // Accessing the flashed data
    // /!\ This flashed data will disappear after accessing it one time.
    session.flash("success");

    return ctx.render({
      session: session.data, // You can pass the whole session data to the page
    });
  },
};

export default function Dashboard({ data }: PageProps<Data>) {
  return <div>You are logged in as {data.session.email}</div>;
}
```

## Usage Cookie Options

session value is cookie. can set the option for cookie.

```ts
import { cookieSession } from "fresh-session";

export const handler = [
  cookieSession({
    maxAge: 30, //Session keep is 30 seconds.
    httpOnly: true,
  }),
];
```

## cookie session based on Redis

In addition to JWT, values can be stored in Redis.

```ts
import { redisSession } from "fresh-session/mod.ts";
import { connect } from "redis/mod.ts";

const redis = await connect({
  hostname: "something redis server",
  port: 6379,
});

export const handler = [redisSession(redis)];

// or Customizable cookie options and Redis key prefix

export const handler = [
  redisSession(redis, {
    keyPrefix: "S_",
    maxAge: 10,
  }),
];
```

## FAQ &amp; Troubleshooting Errors

Some common questions and troubleshooting errors.

### "TypeError: Headers are immutable."

If you are receiving this error, you are likely using a Response.redirect, which
makes the headers immutable. A workaround for this is to use the following
instead:

```ts
new Response(null, {
  status: 302,
  headers: {
    Location: "your-url",
  },
});
```

## Credit

Inspiration taken from [Oak Sessions](https://github.com/jcs224/oak_sessions) &
thanks to [@jcs224](https://github.com/jcs224) for all the insight!
