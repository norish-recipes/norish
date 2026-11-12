import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";
import type { ChildProcess } from "node:child_process";

import type { ServerConfig } from "@norish/config/env-config-server";
import {
  buildInternalParserApiUrl,
  INTERNAL_PARSER_API_HOST,
  INTERNAL_PARSER_API_PORT,
  INTERNAL_PARSER_API_URL,
} from "@norish/config/env-config-server";
import { parserLogger as log } from "@norish/shared-server/logger";
import { withTimeout } from "@norish/shared/lib/with-timeout";

const EMBEDDED_PARSER_STARTUP_TIMEOUT_MS = 15_000;
const EMBEDDED_PARSER_HEALTHCHECK_TIMEOUT_MS = 1_000;
const EMBEDDED_PARSER_SHUTDOWN_TIMEOUT_MS = 10_000;
const EMBEDDED_PARSER_POLL_INTERVAL_MS = 250;

type EmbeddedParserHandle = {
  stop: () => Promise<void>;
};

async function isParserHealthy(timeoutMs: number): Promise<boolean> {
  try {
    const response = await fetch(buildInternalParserApiUrl("/health"), {
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForParserHealthy(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isParserHealthy(EMBEDDED_PARSER_HEALTHCHECK_TIMEOUT_MS)) {
      return;
    }

    await sleep(EMBEDDED_PARSER_POLL_INTERVAL_MS);
  }

  throw new Error(`Embedded parser did not become healthy within ${timeoutMs}ms`);
}

function resolveParserAppDir(): string {
  const candidates = [
    resolve(process.cwd(), "apps/parser-api"),
    resolve(process.cwd(), "../parser-api"),
  ];

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, ".venv/bin/python"))) {
      return candidate;
    }
  }

  throw new Error(`Embedded parser runtime was not found. Checked: ${candidates.join(", ")}`);
}

/** Log the parser's output, keeping its last lines for a startup failure to report. */
function streamParserLogs(child: ChildProcess): () => string[] {
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

function signalParserProcess(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return;

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);

      return;
    } catch {
      // Fall back to targeting the direct child when no process group exists.
    }
  }

  child.kill(signal);
}

export async function startEmbeddedParser(
  config: ServerConfig
): Promise<EmbeddedParserHandle | null> {
  if (await isParserHealthy(EMBEDDED_PARSER_HEALTHCHECK_TIMEOUT_MS)) {
    log.info({ parserApiUrl: INTERNAL_PARSER_API_URL }, "Using already-running local parser API");

    return null;
  }

  const parserAppDir = resolveParserAppDir();
  const pythonExecutable = resolve(parserAppDir, ".venv/bin/python");
  const args = [
    "-m",
    "uvicorn",
    "app.main:app",
    "--app-dir",
    parserAppDir,
    "--host",
    INTERNAL_PARSER_API_HOST,
    "--port",
    String(INTERNAL_PARSER_API_PORT),
  ];

  if (config.NODE_ENV === "development") {
    args.push("--reload");
  }

  log.info(
    { parserApiUrl: INTERNAL_PARSER_API_URL, pythonExecutable },
    "Starting embedded parser API"
  );

  const child = spawn(pythonExecutable, args, {
    cwd: parserAppDir,
    // The parser stops itself once this process is gone, however it died (app/main.py).
    env: { ...globalThis.process.env, PARSER_API_PARENT_PID: String(process.pid) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  const recentOutput = streamParserLogs(child);

  let isReady = false;
  let isStopping = false;

  const startupErrorPromise = new Promise<never>((_, reject) => {
    child.once("error", (err) => {
      log.error({ err }, "Embedded parser process failed to spawn");
      reject(err);
    });
  });

  const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolvePromise) => {
      child.once("exit", (code, signal) => {
        resolvePromise({ code, signal });
      });
    }
  );

  child.on("exit", (code, signal) => {
    if (isStopping) {
      log.info({ code, signal }, "Embedded parser API stopped");

      return;
    }

    if (!isReady) {
      log.error(
        { code, signal, output: recentOutput() },
        "Embedded parser exited before startup completed"
      );

      return;
    }

    log.fatal({ code, signal }, "Embedded parser exited unexpectedly, shutting down server");
    process.kill(process.pid, "SIGTERM");
  });

  await Promise.race([
    startupErrorPromise,
    waitForParserHealthy(EMBEDDED_PARSER_STARTUP_TIMEOUT_MS),
    exitPromise.then(({ code, signal }) => {
      throw new Error(
        `Embedded parser exited before becoming healthy (code=${code}, signal=${signal})`
      );
    }),
  ]);

  isReady = true;
  log.info({ parserApiUrl: INTERNAL_PARSER_API_URL }, "Embedded parser API is ready");

  return {
    async stop() {
      if (isStopping) {
        await exitPromise;

        return;
      }

      isStopping = true;
      log.info("Stopping embedded parser API");

      signalParserProcess(child, "SIGTERM");

      await withTimeout(
        () => exitPromise,
        EMBEDDED_PARSER_SHUTDOWN_TIMEOUT_MS,
        "Embedded parser shutdown"
      ).catch(() => {
        log.warn("Embedded parser shutdown timed out, forcing termination");
        signalParserProcess(child, "SIGKILL");

        return exitPromise;
      });
    },
  };
}
