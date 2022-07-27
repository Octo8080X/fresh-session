#!/usr/bin/env -S deno run -A --watch=static/,routes/

Deno.env.set("APP_KEY", "not-secret");

import dev from "$fresh/dev.ts";

await dev(import.meta.url, "./main.ts");
