import { freshTestWrapper } from "./wrapper.js";
import { assertEquals } from "$std/assert/assert_equals.ts";
import { assert } from "$std/assert/assert.ts";
import { Status } from "$std/http/http_status.ts";
import { wrapFetch } from "cookiejar";

const fetch = wrapFetch();

const BASE_URL = "http://localhost:8000";

Deno.env.set("APP_KEY", "something_for_testing");

Deno.test(
  "The Dashboard should show a new login",
  {
    sanitizeResources: false,
    sanitizeOps: false,
  },
  freshTestWrapper(async (t) => {
    const EMAIL = "taylor@example.com";

    await t.step("The dashboard shows nothing", async () => {
      const response = await fetch(`${BASE_URL}/dashboard`);
      assertEquals(response.status, Status.OK);
      const text = await response.text();
      assert(!text.includes("<div>Flashed message: test</div>"));
    });

    await t.step("Post index page with 'email' form data.", async () => {
      const body = new FormData();
      body.append("email", EMAIL);
      const response = await fetch(`${BASE_URL}`, {
        method: "POST",
        body,
      });
      const text = await response.text();
      assert(
        text.includes(
          `<li>email: ${EMAIL}</li>`,
        ),
      );
      assertEquals(response.status, Status.OK);
    });

    await t.step("The dashboard shows the login", async () => {
      const response = await fetch(`${BASE_URL}/dashboard`);
      const text = await response.text();
      console.log(text);
      assert(
        text.includes(
          `You are logged in as ${EMAIL}`,
        ),
      );
      assertEquals(response.status, Status.OK);
    });
  }),
);
