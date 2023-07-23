/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

export const PORT = 8000;

import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";

await start(manifest, { port: PORT });
