import { Handlers } from "$fresh/server.ts";
import { WithSession } from "fresh-session";

export const handler: Handlers<null, WithSession> = {
  POST(_req, ctx) {
    ctx.state.session.set("msg", "test");
    ctx.state.session.flash("errors", [{ msg: "test 2" }]);

    return new Response(null, { status: 303, headers: { "Location": "/" } });
  },
};
