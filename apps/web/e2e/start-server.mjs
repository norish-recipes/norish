import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(webDirectory, "e2e", "docker-compose.yml");
const externalServices = process.env.NORISH_E2E_EXTERNAL_SERVICES === "1";
const nodeEnvironment = process.env.NORISH_E2E_DEVELOPMENT === "1" ? "development" : "production";
const baseURL = process.env.NORISH_E2E_BASE_URL ?? "http://localhost:3300";
const databaseURL = externalServices
  ? process.env.DATABASE_URL
  : "postgresql://norish_e2e:norish_e2e@127.0.0.1:55432/norish_e2e";
const redisURL = externalServices ? process.env.REDIS_URL : "redis://127.0.0.1:56379";

if (!databaseURL || !redisURL) {
  throw new Error("External E2E services require DATABASE_URL and REDIS_URL");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: webDirectory,
      stdio: "inherit",
      ...options,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code} and signal ${signal}`));
    });
  });
}

async function resetServices() {
  if (externalServices) return;

  await run("docker", ["compose", "-f", composeFile, "down", "--volumes", "--remove-orphans"]);
  await run("docker", ["compose", "-f", composeFile, "up", "-d", "--wait"]);
}

function appEnvironment() {
  return {
    ...process.env,
    AUTH_URL: baseURL,
    CHROME_WS_ENDPOINT: process.env.CHROME_WS_ENDPOINT ?? "ws://127.0.0.1:9222",
    DATABASE_URL: databaseURL,
    HOST: "127.0.0.1",
    LOG_LEVEL: process.env.LOG_LEVEL ?? "warn",
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: nodeEnvironment,
    OIDC_CLIENT_ID: "",
    OIDC_CLIENT_SECRET: "",
    OIDC_ISSUER: "",
    PORT: "3300",
    REDIS_URL: redisURL,
    UPLOADS_DIR: path.join(webDirectory, "e2e", ".tmp", "uploads"),
  };
}

function startParserHealthStub() {
  const server = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"status":"ok"}');

      return;
    }

    response.writeHead(404);
    response.end();
  });

  return new Promise((resolve, reject) => {
    server.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        resolve(null);
      } else {
        reject(error);
      }
    });
    server.listen(8001, "127.0.0.1", () => resolve(server));
  });
}

await resetServices();
if (nodeEnvironment === "production" && process.env.NORISH_E2E_SKIP_BUILD !== "1") {
  await run("pnpm", ["run", "build:web"], { env: appEnvironment() });
}
const parserStub = await startParserHealthStub();
const app = spawn("pnpm", ["exec", "tsx", "server/index.ts"], {
  cwd: webDirectory,
  env: appEnvironment(),
  stdio: "inherit",
});

let stopping = false;
async function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  parserStub?.close();
  app.kill(signal);
  if (!externalServices) {
    await run("docker", [
      "compose",
      "-f",
      composeFile,
      "down",
      "--volumes",
      "--remove-orphans",
    ]).catch(() => undefined);
  }
}

process.once("SIGINT", () => void stop("SIGINT"));
process.once("SIGTERM", () => void stop("SIGTERM"));
app.once("exit", (code) => {
  parserStub?.close();
  process.exit(code ?? 1);
});
