#!/usr/bin/env -S deno run -A --watch=static/,routes/

Deno.env.set("APP_KEY", "password-at-least-32-characters-long");

import dev from "$fresh/dev.ts";

await dev(import.meta.url, "./main.ts");
