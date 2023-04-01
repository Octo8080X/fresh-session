import { HandlerContext, Handlers, PageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { WithSession } from "fresh-session/mod.ts";
export type SessionData = { session: Record<string, string>; message?: string };

export const handler: Handlers<SessionData, WithSession> = {
  GET(_req: Request, ctx: HandlerContext<SessionData, WithSession>) {
    const { session } = ctx.state;

    const message = session.flash("message");

    return ctx.render({
      session: session.data,
      message,
    });
  },
  async POST(req: Request, ctx: HandlerContext<SessionData, WithSession>) {
    const { session } = ctx.state;
    const form = await req.formData();

    if (
      typeof form.get("method") === "string" &&
      form.get("method") === "DELETE"
    ) {
      session.clear();
      session.flash("message", "Delete value!");
    } else {
      const text = form.get("new_session_text_value");
      session.set("text", text);
      session.flash("message", "Session value update!");
    }

    return new Response("", {
      status: 303,
      headers: { Location: "/" },
    });
  },
};

export default function Index({ data }: PageProps<SessionData>) {
  return (
    <>
      <Head>
        <title>frash-session example[redis in use]</title>
      </Head>
      <div>
        <div>Flash Message: {data.message}</div>
        <div>Now Session Value: {data.session.text}</div>
        <div>
          <form method="POST" action="/">
            <div>
              <input
                type="text"
                name="new_session_text_value"
                placeholder="New session_text_value"
              />
            </div>
            <div>
              <button type="submit">Update Session Value!</button>
            </div>
          </form>
          <form method="POST" action="/">
            <input type="hidden" name="method" value="DELETE" />
            <button type="submit">Delete Session!</button>
          </form>
        </div>
      </div>
    </>
  );
}
