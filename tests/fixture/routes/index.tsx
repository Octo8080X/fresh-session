/** @jsx h */
import { h } from "preact";
import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET(_req, ctx) {
    const { session } = ctx.state;

    return ctx.render({ session: session.data });
  },

  async POST(req, ctx) {
    const formData = await req.formData();

    // ctx.state.session.data = {
    //   email: formData.get("email"),
    // };
    ctx.state.session.set("email", formData.get("email"));

    return new Response(null, {
      status: 303,
      headers: {
        "Location": "/",
      },
    });
  },
};

export default function Home({ data }) {
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
