# Fresh Session 🍋

Dead simple cookie-based session for [Deno Fresh](https://fresh.deno.dev).

## Get started

Fresh Session comes with a simple middleware to add at the root of your project,
which will create or resolve a session from the request cookie.

### Create a root middleware (`./routes/_middleware.ts`)

```ts
import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { handler as sessionHandler, Session } from "fresh-session";

export type State = {
  session: Session;
};

export function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  return sessionHandler(req, ctx);
}
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
import { WithSession } from "fresh-session";

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

    // You can pass the session data to the page
    return ctx.render({ session: session.data });
  },
};

export default function Dashboard({ data }: PageProps<Data>) {
  return <div>You are logged in as {data.session.email}</div>;
}
```
