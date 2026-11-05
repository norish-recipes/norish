// Seeds a disposable account with unchecked groceries, runs the Maestro flows on the booted
// simulator, then checks the groceries are done on the server, where the web client reads it.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import net from "node:net";
import path from "node:path";

const env = {
  NORISH_SERVER_URL: "http://localhost:3000",
  NORISH_EMAIL: "maestro@norish.test",
  NORISH_PASSWORD: "maestro-password-1",
  NORISH_GROCERY: "maestrocheck",
  NORISH_OFFLINE_GROCERY: "maestrooffline",
  NORISH_PROXY_PORT: "3998",
  NORISH_PROXY_CONTROL_PORT: "3997",
  NORISH_OLD_SERVER_PORT: "3999",
  ...process.env,
};
const server = env.NORISH_SERVER_URL.replace(/\/+$/, "");
let cookie = "";

async function call(pathname, body) {
  const response = await fetch(`${server}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", origin: server, cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { ok: response.ok, response, data: await response.json().catch(() => null) };
}

const trpc = async (procedure, input) => {
  const { ok, data } = await call(`/api/trpc/${procedure}`, input && { json: input });

  if (!ok) throw new Error(`${procedure} failed: ${JSON.stringify(data)}`);

  return data.result.data.json;
};

const seeded = [env.NORISH_GROCERY, env.NORISH_OFFLINE_GROCERY];
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

const stale = (await ours()).map(({ id, version }) => ({ id, version }));

if (stale.length > 0) await trpc("groceries.delete", { groceries: stale });
await trpc(
  "groceries.create",
  seeded.map((name) => ({ name, unit: null, amount: null }))
);

// The offline flow talks to the server through this proxy and cuts it with `POST /cut`, so the
// backend is unreachable while the simulator's network stays up.
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
const listenProxy = () => proxy.listen(Number(env.NORISH_PROXY_PORT));
const control = createServer((request, response) => {
  if (request.url === "/cut") {
    proxy.close();
    for (const socket of sockets) socket.destroy();
  } else if (request.url === "/restore" && !proxy.listening) {
    listenProxy();
  }
  response.end();
}).listen(Number(env.NORISH_PROXY_CONTROL_PORT));

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
  NORISH_SERVER_URL: env.NORISH_SERVER_URL,
  NORISH_EMAIL: env.NORISH_EMAIL,
  NORISH_PASSWORD: env.NORISH_PASSWORD,
  NORISH_GROCERY: env.NORISH_GROCERY,
  NORISH_OFFLINE_GROCERY: env.NORISH_OFFLINE_GROCERY,
  NORISH_PROXY_URL: `http://localhost:${env.NORISH_PROXY_PORT}`,
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
  response.end(JSON.stringify({ status: "ok", version: "0.1.0" }));
}).listen(Number(env.NORISH_OLD_SERVER_PORT));

await maestro(path.join(flows, "old-server"), {
  NORISH_OLD_SERVER_URL: `http://localhost:${env.NORISH_OLD_SERVER_PORT}`,
});
oldServer.close();
