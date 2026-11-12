// Seeds a disposable account with unchecked groceries, runs the Maestro flows on the booted
// simulator, then checks the groceries are done on the server, where the web client reads it.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { ValkeyContainer } from "@testcontainers/valkey";

const env = {
  NORISH_EMAIL: "maestro@norish.test",
  NORISH_PASSWORD: "maestro-password-1",
  NORISH_GROCERY: "maestrocheck",
  NORISH_OFFLINE_GROCERY: "maestrooffline",
  NORISH_REALTIME_GROCERY: "maestrorealtime",
  NORISH_PROXY_PORT: "3998",
  NORISH_PROXY_CONTROL_PORT: "3997",
  NORISH_OLD_SERVER_PORT: "3999",
  ...process.env,
};
// The simulator shares the host's loopback, so nothing here is opened to the network.
const LOOPBACK = "127.0.0.1";

async function freePort() {
  const probe = net.createServer().listen(0, LOOPBACK);

  await once(probe, "listening");
  const { port } = probe.address();

  probe.close();

  return port;
}

// Without NORISH_SERVER_URL the flows get the web build on throwaway Postgres and Valkey
// containers, which Testcontainers removes even when this run dies.
async function startServer() {
  const webDir = path.join(import.meta.dirname, "../../web");
  const build = path.join(webDir, ".next/required-server-files.json");

  if (!existsSync(build)) throw new Error("No web build: run `pnpm build:web` first");

  const [postgres, valkey] = await Promise.all([
    new PostgreSqlContainer("postgres:17-alpine").start(),
    new ValkeyContainer("valkey/valkey:9").start(),
  ]);
  const port = await freePort();
  // A build made under a base path is served under it, as in the browser E2E.
  const basePath = JSON.parse(readFileSync(build, "utf8")).config.basePath ?? "";
  const url = `http://localhost:${port}${basePath}`;
  const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: webDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      PARSER_API_PORT: String(await freePort()),
      DATABASE_URL: postgres.getConnectionUri(),
      VALKEY_URL: valkey.getConnectionUrl().replace(/^redis:/, "valkey:"),
      AUTH_URL: url,
      TRUSTED_ORIGINS: new URL(url).origin,
      NEXT_PUBLIC_BASE_PATH: basePath,
      MASTER_KEY: randomBytes(32).toString("base64"),
      UPLOADS_DIR: await mkdtemp(path.join(os.tmpdir(), "norish-maestro-")),
      PASSWORD_AUTH_ENABLED: "true",
      AUTH_RATE_LIMIT_ENABLED: "false",
      INGREDIENT_CATALOGUE_URL: "",
      LOG_LEVEL: "error",
      NEXT_PUBLIC_LOG_LEVEL: "error",
      TRPC_LOG_LEVEL: "error",
    },
  });

  process.once("exit", () => child.kill("SIGKILL"));

  const deadline = Date.now() + 90_000;

  while (!(await fetch(`${url}/api/v1/health/ready`).catch(() => null))?.ok) {
    if (child.exitCode !== null || Date.now() > deadline) {
      throw new Error("The server did not start");
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    url,
    stop: async () => {
      child.kill();
      await Promise.all([postgres.stop(), valkey.stop()]);
    },
  };
}

const { url: serverUrl, stop: stopServer } = env.NORISH_SERVER_URL
  ? { url: env.NORISH_SERVER_URL, stop: async () => {} }
  : await startServer();
const server = serverUrl.replace(/\/+$/, "");
let cookie = "";

async function call(pathname, body) {
  const response = await fetch(`${server}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", origin: new URL(server).origin, cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { ok: response.ok, response, data: await response.json().catch(() => null) };
}

const trpc = async (procedure, input) => {
  const { ok, data } = await call(`/api/trpc/${procedure}`, input && { json: input });

  if (!ok) throw new Error(`${procedure} failed: ${JSON.stringify(data)}`);

  return data.result.data.json;
};

const seeded = [env.NORISH_GROCERY, env.NORISH_OFFLINE_GROCERY, env.NORISH_REALTIME_GROCERY];
const ours = async () =>
  (await trpc("groceries.list")).groceries.filter((g) => seeded.includes(g.name));

const credentials = { email: env.NORISH_EMAIL, password: env.NORISH_PASSWORD };

// Fails once the account exists, or when registration is closed and it was made by hand.
await call("/api/auth/sign-up/email", { ...credentials, name: "Maestro" });

const signIn = await call("/api/auth/sign-in/email", credentials);

if (!signIn.ok) throw new Error(`Cannot sign in as ${env.NORISH_EMAIL}: ${signIn.response.status}`);
cookie = signIn.response.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");

// The first Account closes registration; the Sign up flow needs it open. Only an admin can, so a
// server whose registration was set by hand keeps that setting.
await call("/api/trpc/admin.updateRegistration", { json: true });

const stale = (await ours()).map(({ id, version }) => ({ id, version }));

if (stale.length > 0) await trpc("groceries.delete", { groceries: stale });
await trpc(
  "groceries.create",
  seeded.map((name) => ({ name, unit: null, amount: null }))
);

// The flows find each checkbox by its id, since iOS reports the checked state in its value.
const idOf = Object.fromEntries((await ours()).map(({ name, id }) => [name, id]));

// The offline flow cuts this proxy (`POST /cut`) so the backend goes while the simulator's network
// stays; the realtime flow has the web's check-off done with `POST /check-on-web`.
const backend = new URL(server);
const sockets = new Set();
const proxy = net.createServer((client) => {
  const upstream = net.connect(Number(backend.port || 80), backend.hostname);

  for (const socket of [client, upstream]) {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {
      client.destroy();
      upstream.destroy();
    });
  }
  client.pipe(upstream).pipe(client);
});
const listenProxy = () => proxy.listen(Number(env.NORISH_PROXY_PORT), LOOPBACK);
const control = createServer(async (request, response) => {
  if (request.url === "/check-on-web") {
    const { id, version } = (await ours()).find((g) => g.name === env.NORISH_REALTIME_GROCERY);

    await trpc("groceries.toggle", { groceries: [{ id, version }], isDone: true });
  } else if (request.url === "/cut") {
    proxy.close();
    for (const socket of sockets) socket.destroy();
  } else if (request.url === "/restore" && !proxy.listening) {
    listenProxy();
  }
  response.end();
}).listen(Number(env.NORISH_PROXY_CONTROL_PORT), LOOPBACK);

listenProxy();

const flows = path.join(import.meta.dirname, "..", "maestro");

// Async, so the old-server stub below keeps answering while Maestro runs.
async function maestro(folder, vars) {
  const args = Object.entries(vars).flatMap(([name, value]) => ["-e", `${name}=${value}`]);
  const [code] = await once(
    spawn("maestro", ["test", ...args, folder], { stdio: "inherit" }),
    "exit"
  );

  if (code !== 0) process.exit(code ?? 1);
}

await maestro(flows, {
  NORISH_SERVER_URL: server,
  NORISH_EMAIL: env.NORISH_EMAIL,
  NORISH_PASSWORD: env.NORISH_PASSWORD,
  NORISH_GROCERY_ID: idOf[env.NORISH_GROCERY],
  NORISH_OFFLINE_GROCERY_ID: idOf[env.NORISH_OFFLINE_GROCERY],
  NORISH_REALTIME_GROCERY_ID: idOf[env.NORISH_REALTIME_GROCERY],
  // The proxy forwards bytes, so a base path stays on the address the app is given.
  NORISH_PROXY_URL: `http://localhost:${env.NORISH_PROXY_PORT}${server.slice(backend.origin.length)}`,
  NORISH_PROXY_CONTROL_URL: `http://localhost:${env.NORISH_PROXY_CONTROL_PORT}`,
});
proxy.close();
control.close();

const after = await ours();

for (const name of seeded) {
  if (!after.some((grocery) => grocery.name === name && grocery.isDone)) {
    throw new Error(`${name} is not done on the server`);
  }
}

// A server older than the app supports: its readiness probe reports 0.1.0.
const oldServer = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "ok", version: "0.1.0", parser: { status: "ok" } }));
}).listen(Number(env.NORISH_OLD_SERVER_PORT), LOOPBACK);

await maestro(path.join(flows, "old-server"), {
  NORISH_OLD_SERVER_URL: `http://localhost:${env.NORISH_OLD_SERVER_PORT}`,
});
oldServer.close();
await stopServer();
