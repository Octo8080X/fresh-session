import { createHandler, ServeHandlerInfo } from "https://deno.land/x/fresh@1.5.4/server.ts";
import manifest from "./work/fresh.gen.ts";
import config from "./config/redis_session_test_plugin_fresh.config.ts";
import { assert, assertEquals } from "$std/testing/asserts.ts";

const CONN_INFO: ServeHandlerInfo = {
  remoteAddr: { hostname: "127.0.0.1", port: 53496, transport: "tcp" },
};

Deno.test("Redis Session Test", async (t) => {
  const handler = await createHandler(manifest, config);

  await t.step("Work Session", async () => {
    let resp = await handler(new Request("http://127.0.0.1/session"), CONN_INFO);
    assertEquals(resp.status, 200);

    let text = await resp.text();
    assertEquals(text.includes("<p>count:0</p>"), true);

    const sessionKey = (resp.headers.get("set-cookie")!).split("session=")[1].split(";")[0];

    resp = await handler(new Request("http://127.0.0.1/session", {headers: {cookie: `session=${sessionKey}`}}), CONN_INFO);
    assertEquals(resp.status, 200);
    text = await resp.text();
    assertEquals(text.includes("<p>count:1</p>"), true);

  });
  await t.step("Not Work Session(unset cookie)", async () => {
    let resp = await handler(new Request("http://127.0.0.1/session"), CONN_INFO);
    assertEquals(resp.status, 200);

    let text = await resp.text();
    assertEquals(text.includes("<p>count:0</p>"), true);

    resp = await handler(new Request("http://127.0.0.1/session"), CONN_INFO);
    assertEquals(resp.status, 200);
    text = await resp.text();
    assertEquals(text.includes("<p>count:0</p>"), true);

  });

  await t.step("Not Work Session(incorrect cookie)", async () => {
    let resp = await handler(new Request("http://127.0.0.1/session"), CONN_INFO);
    assertEquals(resp.status, 200);

    let text = await resp.text();
    assertEquals(text.includes("<p>count:0</p>"), true);

    const sessionKey = (resp.headers.get("set-cookie")!).split("session=")[1].split(";")[0];

    resp = await handler(new Request("http://127.0.0.1/session", {headers: {cookie: `session=${sessionKey}AA`}}), CONN_INFO);
    assertEquals(resp.status, 200);
    text = await resp.text();
    assertEquals(text.includes("<p>count:0</p>"), true);

  });
});
