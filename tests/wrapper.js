import { delay } from "https://deno.land/std@0.192.0/async/delay.ts";
import { startFreshServer } from "https://deno.land/x/fresh@1.3.1/tests/test_utils.ts";

export const freshTestWrapper = (theTests) => async (t) => {
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
