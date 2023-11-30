import { defineConfig } from "$fresh/server.ts";
import { getRedisSessionPlugin } from "../../mod.ts";
import { testPlugin } from "../plugin/test_plugin.ts";
import Redis from 'https://unpkg.com/ioredis-mock';
const redis = new Redis()

export default defineConfig({
  plugins: [getRedisSessionPlugin("/", {client: redis}), testPlugin],
});
