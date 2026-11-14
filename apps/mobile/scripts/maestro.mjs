// Signs in a disposable account and runs the Maestro flows on the booted simulator.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { ValkeyContainer } from "@testcontainers/valkey";

import { importPageName, seeder, serveRecipePage } from "./maestro-seed.mjs";

// An optional argument runs that one flow, with the same setup, instead of the whole folder.
const only = process.argv[2] && path.resolve(process.argv[2]);

if (only && !existsSync(only)) throw new Error(`No flow at ${only}`);

const env = {
  NORISH_EMAIL: "maestro@norish.test",
  NORISH_PASSWORD: "maestro-password-1",
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
      // The import flows' recipe page answers on loopback.
      ALLOW_PRIVATE_ADDRESSES: "true",
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
      await once(child, "exit");
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

// GET with the input in the query string, as tRPC reads a query.
const query = async (procedure, input) => {
  const { ok, data } = await call(
    `/api/trpc/${procedure}${input ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : ""}`
  );

  if (!ok) throw new Error(`${procedure} failed: ${JSON.stringify(data)}`);

  return data.result.data.json;
};
const seed = seeder({ trpc, query });
const recipePage = await serveRecipePage(LOOPBACK);

const credentials = { email: env.NORISH_EMAIL, password: env.NORISH_PASSWORD };

// Fails once the account exists, or when registration is closed and it was made by hand.
await call("/api/auth/sign-up/email", { ...credentials, name: "Maestro" });

const signIn = await call("/api/auth/sign-in/email", credentials);

if (!signIn.ok) throw new Error(`Cannot sign in as ${env.NORISH_EMAIL}: ${signIn.response.status}`);
cookie = signIn.response.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");

// The first Account closes registration; the Sign up flow needs it open, so it is opened here and
// put back when the run ends. Only an admin can open it: the seeded Account is one on a new server.
const registrationWasOpen = (await trpc("config.authProviders")).registrationEnabled;
const setRegistration = (enabled) => call("/api/trpc/admin.updateRegistration", { json: enabled });

if (!registrationWasOpen) {
  const opened = await setRegistration(true);

  if (!opened.ok) {
    throw new Error(
      `Cannot open registration on ${server} for the Sign up flow (${opened.response.status}): ` +
        `${env.NORISH_EMAIL} is not an admin. Open registration by hand, or name an admin with ` +
        "NORISH_EMAIL and NORISH_PASSWORD."
    );
  }
  console.log(`Opened registration on ${server}; it is closed again when the run ends.`);
}

// The offline flow cuts this proxy (`POST /cut`) so the backend goes while the simulator's network stays.
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
  // `POST /reset`, `POST /recipe` (a JSON body), `GET /count?name=` and `GET /groceries` answer in JSON.
  const route = new URL(request.url ?? "/", "http://control");
  const body = await new Promise((resolve) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString()));
  });

  try {
    if (route.pathname === "/reset") {
      await seed.reset();
    } else if (route.pathname === "/recipe") {
      response.write(JSON.stringify({ id: await seed.createRecipe(JSON.parse(body)) }));
    } else if (route.pathname === "/count") {
      response.write(
        JSON.stringify({ count: await seed.countRecipes(route.searchParams.get("name")) })
      );
    } else if (route.pathname === "/groceries") {
      response.write(
        JSON.stringify({
          names: await seed.groceryNames(Number(route.searchParams.get("min") ?? 0)),
        })
      );
    } else if (request.url === "/cut") {
      proxy.close();
      for (const socket of sockets) socket.destroy();
    } else if (request.url === "/restore" && !proxy.listening) {
      listenProxy();
    } else if (request.url === "/old" || request.url === "/real") {
      tooOld = request.url === "/old";
    } else if (request.url === "/revoke-other-sessions") {
      // This script's own session stays; the app's, signed in as the same Account, ends.
      await call("/api/auth/revoke-other-sessions", {});
    }
  } catch (error) {
    // A seed that failed fails the flow's next step, not the run.
    console.error(`${route.pathname}: ${error.message}`);
    response.statusCode = 500;
  }
  response.end();
}).listen(Number(env.NORISH_PROXY_CONTROL_PORT), LOOPBACK);

listenProxy();

const flows = path.join(import.meta.dirname, "..", "maestro");
// With several simulators booted, NORISH_SIMULATOR names the one to use (its udid).
const simulator = env.NORISH_SIMULATOR ?? "booted";

// iOS offers to save and to suggest passwords in sheets that Maestro cannot select, so AutoFill is
// switched off on the simulator, as Settings > AutoFill & Passwords does.
spawnSync(
  "xcrun",
  [
    "simctl",
    "spawn",
    simulator,
    "defaults",
    "write",
    "com.apple.WebUI",
    "AutoFillPasswords",
    "-bool",
    "false",
  ],
  { stdio: "inherit" }
);
// Async, so the version proxy below keeps answering while Maestro runs.
async function maestro(target, vars) {
  const args = Object.entries(vars).flatMap(([name, value]) => ["-e", `${name}=${value}`]);
  const [code] = await once(
    spawn(
      "maestro",
      [...(env.NORISH_SIMULATOR ? ["--udid", simulator] : []), "test", ...args, target],
      { stdio: "inherit" }
    ),
    "exit"
  );

  if (code !== 0) throw Object.assign(new Error(`Maestro exited with ${code}`), { code });
}

// The throwaway server behind a proxy that reports a version too old for the app while `tooOld` is
// set, which the flows switch on the control port (`/old`, `/real`). Everything else is forwarded.
const OLD_SERVER_VERSION = "0.1.0";
let tooOld = false;
const versionProxy = createServer((request, response) => {
  if (tooOld && request.url?.startsWith(`${backend.pathname.replace(/\/+$/, "")}/api/v1/health`)) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ status: "ok", version: OLD_SERVER_VERSION, parser: { status: "ok" } })
    );

    return;
  }

  const upstream = httpRequest(
    {
      host: backend.hostname,
      port: Number(backend.port || 80),
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: backend.host },
    },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    }
  );

  upstream.on("error", () => {
    response.writeHead(502);
    response.end();
  });
  request.pipe(upstream);
});

versionProxy.on("upgrade", (request, socket, head) => {
  const upstream = net.connect(Number(backend.port || 80), backend.hostname, () => {
    const headers = { ...request.headers, host: backend.host };

    upstream.write(
      `${request.method} ${request.url} HTTP/1.1\r\n` +
        Object.entries(headers)
          .map(([name, value]) => `${name}: ${value}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
versionProxy.listen(Number(env.NORISH_OLD_SERVER_PORT), LOOPBACK);
// A provider this server lists as OAuth, for the Sign-in failed flow's deep link.
const oauthProvider = (await trpc("config.authProviders")).providers.find(
  (provider) => provider.type === "oauth"
);

if (!oauthProvider)
  throw new Error(`${server} lists no OAuth provider for the Sign-in failed flow`);

const appVersion = JSON.parse(readFileSync(path.join(flows, "../package.json"), "utf8")).version;
// The app's minimum, as in src/features/auth/utils/server-version.ts.
const minimumVersion = appVersion.replace(/^(\d+\.\d+)\..*$/, "$1.0");
// English copy the flows assert, from the catalogue so a rewording stays in step.
const { signup, signInFailed, updateServer } = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "../../../packages/i18n/src/messages/en/auth.json"),
    "utf8"
  )
);

const vars = {
  NORISH_SERVER_URL: server,
  NORISH_SERVER_HOST: backend.host,
  // The version proxy: the real server's address, until `/old` makes its version check say too old.
  NORISH_VERSION_PROXY_URL: `http://localhost:${env.NORISH_OLD_SERVER_PORT}${server.slice(backend.origin.length)}`,
  NORISH_VERSION_PROXY_HOST: `localhost:${env.NORISH_OLD_SERVER_PORT}`,
  NORISH_OLD_SERVER_VERSION: OLD_SERVER_VERSION,
  NORISH_OAUTH_PROVIDER_ID: oauthProvider.id,
  NORISH_COPY_SIGN_IN_FAILED_TITLE: signInFailed.title,
  NORISH_COPY_SIGN_IN_FAILED_NAMED: signInFailed.description.replace(
    "{provider}",
    oauthProvider.name
  ),
  NORISH_COPY_SIGN_IN_FAILED_UNNAMED: signInFailed.descriptionUnnamed,
  NORISH_COPY_UPDATE_SERVER_TITLE: updateServer.title,
  NORISH_MINIMUM_SERVER_VERSION: minimumVersion,
  NORISH_COPY_PASSWORD_MISMATCH: signup.errors.passwordMismatch,
  NORISH_EMAIL: env.NORISH_EMAIL,
  NORISH_PASSWORD: env.NORISH_PASSWORD,
  // The proxy forwards bytes, so a base path stays on the address the app is given.
  NORISH_PROXY_URL: `http://localhost:${env.NORISH_PROXY_PORT}${server.slice(backend.origin.length)}`,
  NORISH_PROXY_CONTROL_URL: `http://localhost:${env.NORISH_PROXY_CONTROL_PORT}`,
  // The recipe page the import flows read; the server fetches it, never the app.
  NORISH_IMPORT_URL: `http://127.0.0.1:${recipePage.address().port}/recipe`,
  NORISH_IMPORT_NAME: importPageName,
};

try {
  await maestro(only ?? flows, vars);
  proxy.close();

  if (!only) await maestro(path.join(flows, "old-server"), vars);
} catch (error) {
  console.error(error.message);
  process.exitCode = error.code ?? 1;
} finally {
  control.close();
  recipePage.close();
  versionProxy.close();
  if (!registrationWasOpen) {
    const closed = await setRegistration(false).catch(() => null);

    console.log(
      closed?.ok
        ? `Closed registration on ${server} again.`
        : `Could not close registration on ${server}: close it again by hand.`
    );
  }
  await stopServer();
  process.exit();
}
