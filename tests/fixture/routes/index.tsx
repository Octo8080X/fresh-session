import { Handlers, PageProps } from "$fresh/server.ts";
import type { WithSession } from "fresh-session";

export type Data = {
  session: Record<string, string>;
  flashedMessage?: string;
  msg?: string;
  errors?: unknown[];
};

export const handler: Handlers<
  Data,
  WithSession
> = {
  GET(_req, ctx) {
    const { session } = ctx.state;

    const flashedMessage = ctx.state.session.flash("success");
    const msg = ctx.state.session.get("msg");
    const errors = ctx.state.session.flash("errors");

    return ctx.render({ session: session.data, flashedMessage, msg, errors });
  },

  async POST(req, ctx) {
    const formData = await req.formData();

    // ctx.state.session.data = {
    //   email: formData.get("email"),
    // };
    ctx.state.session.set("email", formData.get("email"));
    ctx.state.session.flash("success", 'Successfully "logged in"');

    return new Response(null, {
      status: 303,
      headers: {
        "Location": "/",
      },
    });
  },
};

export default function Home({ data }: PageProps<Data>) {
  return (
    <main>
      {!!data.flashedMessage && (
        <div>
          Flashed message: {data.flashedMessage}
        </div>
      )}

      {!!data.msg && (
        <div>
          Flashed message: {data.msg}
        </div>
      )}

      {!!data.errors && (
        <div>
          Flashed message: {JSON.stringify(data.errors)}
        </div>
      )}

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

      <section>
        <form action="/other-route" method="post">
          <button type="submit">Login</button>
        </form>
      </section>
    </main>
  );
}
