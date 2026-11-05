// Seeds a disposable account with one unchecked grocery, runs the Maestro flows on the booted
// simulator, then checks the grocery is done on the server, where the web client reads it.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";

const env = {
  NORISH_SERVER_URL: "http://localhost:3000",
  NORISH_EMAIL: "maestro@norish.test",
  NORISH_PASSWORD: "maestro-password-1",
  NORISH_GROCERY: "maestrocheck",
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

const ours = async () =>
  (await trpc("groceries.list")).groceries.filter((g) => g.name === env.NORISH_GROCERY);

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
await trpc("groceries.create", [{ name: env.NORISH_GROCERY, unit: null, amount: null }]);

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
});

const after = await ours();

if (after.length === 0 || !after.every((grocery) => grocery.isDone)) {
  throw new Error(`${env.NORISH_GROCERY} is not done on the server`);
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
