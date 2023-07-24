import { BASE_URL, fixtureTestWrapper } from "./wrapper.js";
import { assert, assertEquals } from "$std/assert/mod.ts";
import { Status } from "$std/http/http_status.ts";
import { wrapFetch } from "cookiejar";

const fetch = wrapFetch();

Deno.test(
  "The Dashboard should show a new login",
  {
    sanitizeResources: false,
    sanitizeOps: false,
  },
  fixtureTestWrapper(async (t) => {
    const EMAIL = "example@example.com";

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
