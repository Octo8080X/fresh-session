/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
Deno.env.set("APP_KEY", "not-secret");
import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
await start(manifest);
