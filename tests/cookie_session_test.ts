import {
  createHandler,
  ServeHandlerInfo,
} from "https://deno.land/x/fresh@1.5.4/server.ts";
import manifest from "./work/fresh.gen.ts";
import config from "./config/cookie_session_test_plugin_fresh.config.ts";
import { assert, assertEquals } from "$std/testing/asserts.ts";

const CONN_INFO: ServeHandlerInfo = {
  remoteAddr: { hostname: "127.0.0.1", port: 53496, transport: "tcp" },
};

Deno.test("Cookie Session Test", async (t) => {
  const handler = await createHandler(manifest, config);

  await t.step("#1 GET /", async () => {
    let resp = await handler(
      new Request("http://127.0.0.1/session"),
      CONN_INFO,
    );
    assertEquals(resp.status, 200);

    let text = await resp.text();
    assertEquals(text.includes("<p>count:0</p>"), true);

    const sessionKey =
      (resp.headers.get("set-cookie")!).split("session=")[1].split(";")[0];

    resp = await handler(
      new Request("http://127.0.0.1/session", {
        headers: { cookie: `session=${sessionKey}` },
      }),
      CONN_INFO,
    );
    assertEquals(resp.status, 200);
    text = await resp.text();
    assertEquals(text.includes("<p>count:1</p>"), true);
  });

  //  await t.step("#2 POST /", async () => {
  //    const formData = new FormData();
  //    formData.append("text", "Deno!");
  //    const req = new Request("http://127.0.0.1/", {
  //      method: "POST",
  //      body: formData,
  //    });
  //    const resp = await handler(req, CONN_INFO);
  //    assertEquals(resp.status, 303);
  //  });
  //
  //  await t.step("#3 GET /foo", async () => {
  //    const resp = await handler(new Request("http://127.0.0.1/foo"), CONN_INFO);
  //    const text = await resp.text();
  //    assert(text.includes("<div>Hello Foo!</div>"));
  //  });
});
