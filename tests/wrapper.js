import { delay } from "$std/async/delay.ts";
import { startFreshServer } from "$fresh/tests/test_utils.ts";

Deno.env.set("APP_KEY", "something_for_testing");

export const BASE_URL = "http://localhost:8000";

export const fixtureTestWrapper = (theTests) => async (t) => {
  const { serverProcess, lines } = await startFreshServer({
    args: ["run", "-A", "./tests/fixture/main.ts"],
  });
  await theTests(t);
  // Stop the Server
  await lines.cancel();
  serverProcess.kill("SIGTERM");
  // await for the server to close
  await delay(100);
};

export const exampleKVStoreTestWrapper = (theTests) => async (t) => {
  const { serverProcess, lines } = await startFreshServer({
    args: ["run", "-A", "--unstable", "./example/use_kv_store/main.ts"],
  });
  await theTests(t);
  // Stop the Server
  await lines.cancel();
  serverProcess.kill("SIGTERM");
  // await for the server to close
  await delay(100);
};
