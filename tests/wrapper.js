import { delay } from "$std/async/delay.ts";
import { startFreshServer } from "$fresh/tests/test_utils.ts";

Deno.env.set("APP_KEY", "password-at-least-32-characters-long");

export const BASE_URL = "http://localhost:8000";

const myTestWrapper = (args) => (theTests) => async (t) => {
  const { serverProcess, lines } = await startFreshServer({
    args,
  });
  await theTests(t);
  // Stop the Server
  await lines.cancel();
  serverProcess.kill("SIGTERM");
  // await for the server to close
  await delay(100);
};

export const fixtureTestWrapper = myTestWrapper([
  "run",
  "-A",
  "./tests/fixture/main.ts",
]);

export const exampleKVStoreTestWrapper = myTestWrapper([
  "run",
  "-A",
  "--unstable",
  "./example/use_kv_store/main.ts",
]);
