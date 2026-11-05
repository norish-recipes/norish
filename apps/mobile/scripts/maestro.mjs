// Seeds a disposable account with one unchecked grocery, runs the Maestro flows on the booted
// simulator, then checks the grocery is done on the server, where the web client reads it.
import { spawnSync } from "node:child_process";
import path from "node:path";

const env = {
  NORISH_SERVER_URL: "http://localhost:3000",
  NORISH_EMAIL: "maestro@norish.test",
  NORISH_PASSWORD: "maestro-password-1",
  NORISH_GROCERY: "maestrocheck",
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
const vars = ["NORISH_SERVER_URL", "NORISH_EMAIL", "NORISH_PASSWORD", "NORISH_GROCERY"];
const run = spawnSync(
  "maestro",
  ["test", ...vars.flatMap((name) => ["-e", `${name}=${env[name]}`]), flows],
  { stdio: "inherit" }
);

if (run.status !== 0) process.exit(run.status ?? 1);

const after = await ours();

if (after.length === 0 || !after.every((grocery) => grocery.isDone)) {
  throw new Error(`${env.NORISH_GROCERY} is not done on the server`);
}
