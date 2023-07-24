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

    // You can pass the session data to the page
    return ctx.render({ session: session.data });
  },
};

export default function Dashboard({ data }: PageProps<Data>) {
  return <div>You are logged in as {data.session.email}</div>;
}
