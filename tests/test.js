import { freshTestWrapper } from "./wrapper.js";
import { assertEquals } from "https://deno.land/std@0.195.0/assert/assert_equals.ts";
import { Status } from "https://deno.land/std@0.195.0/http/http_status.ts";

const BASE_URL = "http://localhost:8000";

Deno.test(
  "Public Pages Testing",
  {
    sanitizeResources: false,
    sanitizeOps: false,
  },
  freshTestWrapper(async (t, page) => {
    await t.step("The homepage should work", async () => {
      const response = await fetch(`${BASE_URL}`);
      assertEquals(response.status, Status.OK);
    });

    await t.step("The 404 page should 404", async () => {
      const response = await fetch(`${BASE_URL}/404`);
      assertEquals(response.status, Status.NotFound);
    });

    // More steps?
  }),
);
