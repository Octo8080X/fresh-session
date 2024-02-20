import { defineConfig } from "$fresh/server.ts";
import { getCookieSessionPlugin } from "../../mod.ts";
import { testPlugin } from "../plugin/test_plugin.ts";

export default defineConfig({
  plugins: [
    getCookieSessionPlugin("/"),
    testPlugin,
  ],
});
