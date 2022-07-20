/** @jsx h */
import { h } from "preact";
import { Handlers, PageProps } from "$fresh/server.ts";
import type { WithSession } from "fresh-session";

export type Data = { session: Record<string, string> };

export const handler: Handlers<
  Data,
  WithSession
> = {
  GET(_req, ctx) {
    const { session } = ctx.state;

    return ctx.render({ session: session.data });
  },

  async POST(req, ctx) {
    const formData = await req.formData();

    ctx.state.session.set("email", formData.get("email") as string);
    ctx.state.session.flash("message", "Successfully logged in!");

    return new Response(null, {
      status: 303,
      headers: {
        "Location": "/dashboard",
      },
    });
  },
};

export default function Home({ data }: PageProps<Data>) {
  return (
    <main>
      <section>
        <h1>Your session data</h1>

        <ul>
          {Object.entries(data.session).map(([key, value]) => {
            return <li>{key}: {value}</li>;
          })}
        </ul>
      </section>

      <section>
        <form method="post">
          <input name="email" value="example@test.com" />

          <button type="submit">Login</button>
        </form>
      </section>
    </main>
  );
}
