/**
 * The recipe-scrapers parser API, a Python child process started on the first URL import and
 * stopped once no import has used it for a while: it holds ~80 MB that an idle server need not.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";
import type { ChildProcess } from "node:child_process";

import {
  buildInternalParserApiUrl,
  INTERNAL_PARSER_API_HOST,
  INTERNAL_PARSER_API_PORT,
  INTERNAL_PARSER_API_URL,
  SERVER_CONFIG,
} from "@norish/config/env-config-server";
import { childEnv } from "@norish/shared-server/lib/child-env";
import { parserLogger as log } from "@norish/shared-server/logger";
import { withTimeout } from "@norish/shared/lib/with-timeout";

const STARTUP_TIMEOUT_MS = 15_000;
const HEALTHCHECK_TIMEOUT_MS = 1_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 100;
/** How long the parser stays up after the last import that used it. */
export const PARSER_IDLE_STOP_MS = 10 * 60_000;

/** `external`: one already answering on the port when first needed, as `pnpm dev` runs it. */
export type EmbeddedParserState = "idle" | "starting" | "running" | "external";

type Running = { child: ChildProcess; exited: Promise<void> };

let running: Running | null = null;
let external = false;
let starting: Promise<void> | null = null;
let stopping: Promise<void> | null = null;
let inUse = 0;
let idleTimer: NodeJS.Timeout | undefined;

export function embeddedParserState(): EmbeddedParserState {
  if (external) return "external";
  if (running) return "running";

  return starting ? "starting" : "idle";
}

/** Runs `use` against a running parser, starting it first; the idle clock starts once none use it. */
export async function withEmbeddedParser<T>(use: () => Promise<T>): Promise<T> {
  inUse += 1;
  clearTimeout(idleTimer);

  try {
    if (stopping) await stopping;
    if (!running && !external) {
      starting ??= start().finally(() => {
        starting = null;
      });
      await starting;
    }

    return await use();
  } finally {
    inUse -= 1;
    if (inUse === 0 && running) {
      idleTimer = setTimeout(() => void stopEmbeddedParser(), PARSER_IDLE_STOP_MS);
      idleTimer.unref();
    }
  }
}

/** Stops the parser this process started, if it is running; it starts again when next needed. */
export async function stopEmbeddedParser(): Promise<void> {
  clearTimeout(idleTimer);
  if (stopping) return stopping;
  if (!running) return;

  const { child, exited } = running;

  running = null;
  log.info("Stopping embedded parser API");
  signal(child, "SIGTERM");
  stopping = withTimeout(() => exited, SHUTDOWN_TIMEOUT_MS, "Embedded parser shutdown")
    .catch(() => {
      log.warn("Embedded parser shutdown timed out, forcing termination");
      signal(child, "SIGKILL");

      return exited;
    })
    .finally(() => {
      stopping = null;
    });

  return stopping;
}

async function isHealthy(): Promise<boolean> {
  try {
    const response = await fetch(buildInternalParserApiUrl("/health"), {
      signal: AbortSignal.timeout(HEALTHCHECK_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function start(): Promise<void> {
  if (await isHealthy()) {
    log.info({ parserApiUrl: INTERNAL_PARSER_API_URL }, "Using already-running local parser API");
    external = true;

    return;
  }

  const appDir = parserAppDir();
  const python = resolve(appDir, ".venv/bin/python");
  const args = ["-m", "uvicorn", "app.main:app", "--app-dir", appDir];

  args.push("--host", INTERNAL_PARSER_API_HOST, "--port", String(INTERNAL_PARSER_API_PORT));
  if (SERVER_CONFIG.NODE_ENV === "development") args.push("--reload");

  log.info({ parserApiUrl: INTERNAL_PARSER_API_URL, python }, "Starting embedded parser API");

  const child = spawn(python, args, {
    cwd: appDir,
    // The parser stops itself once this process is gone, however it died (app/main.py).
    env: childEnv({ PARSER_API_PARENT_PID: String(process.pid) }),
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  const recentOutput = streamLogs(child);
  const exited = new Promise<void>((done) => child.once("exit", () => done()));
  let exitedEarly = false;

  child.once("exit", (code, exitSignal) => {
    exitedEarly = true;
    if (running?.child !== child) return;
    // Not stopped by us: the next import starts it again.
    running = null;
    log.error({ code, signal: exitSignal }, "Embedded parser exited unexpectedly");
  });
  child.once("error", (err) => log.error({ err }, "Embedded parser process failed to spawn"));

  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (!(await isHealthy())) {
    if (exitedEarly || Date.now() > deadline) {
      signal(child, "SIGKILL");
      log.error({ output: recentOutput() }, "Embedded parser did not become healthy");
      throw new Error("The embedded parser API did not start");
    }
    await sleep(POLL_INTERVAL_MS);
  }

  running = { child, exited };
  log.info({ parserApiUrl: INTERNAL_PARSER_API_URL }, "Embedded parser API is ready");
}

function parserAppDir(): string {
  const candidates = [
    resolve(process.cwd(), "apps/parser-api"),
    resolve(process.cwd(), "../parser-api"),
  ];
  const found = candidates.find((dir) => existsSync(resolve(dir, ".venv/bin/python")));

  if (!found) {
    throw new Error(`Embedded parser runtime was not found. Checked: ${candidates.join(", ")}`);
  }

  return found;
}

/** Logs the parser's output, keeping its last lines for a startup failure to report. */
function streamLogs(child: ChildProcess): () => string[] {
  const recent: string[] = [];

  for (const [stream, input] of [
    ["stdout", child.stdout],
    ["stderr", child.stderr],
  ] as const) {
    if (!input) continue;

    createInterface({ input }).on("line", (line) => {
      log.info({ stream }, line);
      recent.push(line);
      if (recent.length > 20) recent.shift();
    });
  }

  return () => recent;
}

/** Signals the parser's process group, so uvicorn's reloader and workers go with it. */
function signal(child: ChildProcess, name: NodeJS.Signals): void {
  if (!child.pid) return;

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, name);

      return;
    } catch {
      // No process group: signal the child alone.
    }
  }

  child.kill(name);
}
