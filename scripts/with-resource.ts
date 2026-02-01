const REDIS_CONTAINER_NAME = "fresh-session-redis-test";
const MYSQL_CONTAINER_NAME = "fresh-session-mysql-test";
const REDIS_PORT = 6380;
const MYSQL_PORT = 3307;

const MYSQL_DATABASE = Deno.env.get("MYSQL_DATABASE") ?? "fresh_session";
const MYSQL_USER = Deno.env.get("MYSQL_USER") ?? "root";
const MYSQL_PASSWORD = Deno.env.get("MYSQL_PASSWORD") ?? "root";

async function runCommand(
  command: string,
  args: string[],
  options?: {
    env?: Record<string, string>;
    inheritStdio?: boolean;
    ignoreFailure?: boolean;
  },
): Promise<Deno.CommandStatus> {
  const { env, inheritStdio, ignoreFailure } = options ?? {};
  const commandOptions: Deno.CommandOptions = {
    args,
    env,
    stdin: inheritStdio ? "inherit" : "null",
    stdout: inheritStdio ? "inherit" : "null",
    stderr: inheritStdio ? "inherit" : "piped",
  };

  const result = await new Deno.Command(command, commandOptions).output();

  if (!result.success && !ignoreFailure) {
    if (!inheritStdio) {
      const stderrText = new TextDecoder().decode(result.stderr);
      if (stderrText.trim().length > 0) {
        console.error(stderrText.trim());
      }
    }
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }

  return result;
}

async function removeContainer(name: string): Promise<void> {
  await runCommand("docker", ["rm", "-f", name], {
    ignoreFailure: true,
  });
}

async function startRedisContainer(): Promise<void> {
  await removeContainer(REDIS_CONTAINER_NAME);
  console.info("[with-resource] Starting Redis container...");
  await runCommand(
    "docker",
    [
      "run",
      "-d",
      "--name",
      REDIS_CONTAINER_NAME,
      "-p",
      `${REDIS_PORT}:6379`,
      "redis:7-alpine",
    ],
  );
}

async function startMysqlContainer(): Promise<void> {
  await removeContainer(MYSQL_CONTAINER_NAME);
  console.info("[with-resource] Starting MySQL container...");
  await runCommand(
    "docker",
    [
      "run",
      "-d",
      "--name",
      MYSQL_CONTAINER_NAME,
      "-p",
      `${MYSQL_PORT}:3306`,
      "-e",
      `MYSQL_ROOT_PASSWORD=${MYSQL_PASSWORD}`,
      "-e",
      `MYSQL_DATABASE=${MYSQL_DATABASE}`,
      "mysql:8.0",
    ],
  );
}

async function waitForMysqlReady(): Promise<void> {
  console.info("[with-resource] Waiting for MySQL to be ready...");
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await runCommand(
        "docker",
        [
          "exec",
          MYSQL_CONTAINER_NAME,
          "mysqladmin",
          "ping",
          "-uroot",
          `-p${MYSQL_PASSWORD}`,
          "--silent",
        ],
        { ignoreFailure: true },
      );
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("MySQL container did not become ready in time.");
}

function buildCommand(args: string[]): { command: string; args: string[] } {
  const sanitizedArgs = args[0] === "--" ? args.slice(1) : args;
  if (sanitizedArgs.length === 0) {
    throw new Error(
      "Command args are required. Example: -- deno test -E --allow-net",
    );
  }

  const [command, ...rest] = sanitizedArgs;
  return { command, args: rest };
}

async function main(): Promise<number> {
  await startRedisContainer();
  await startMysqlContainer();
  await waitForMysqlReady();

  const { command, args } = buildCommand(Deno.args);
  const env = {
    ...Deno.env.toObject(),
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: `${REDIS_PORT}`,
    MYSQL_HOST: "127.0.0.1",
    MYSQL_PORT: `${MYSQL_PORT}`,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
  };

  let exitCode = 1;
  try {
    const status = await runCommand(command, args, {
      env,
      inheritStdio: true,
    });
    exitCode = status.code;
  } finally {
    await removeContainer(REDIS_CONTAINER_NAME);
    await removeContainer(MYSQL_CONTAINER_NAME);
  }

  return exitCode;
}

const exitCode = await main();
Deno.exit(exitCode);
