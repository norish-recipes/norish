import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import type { ChildProcess } from "node:child_process";

import {
  DIST_SERVER_ENTRY,
  E2E_BASE_URL,
  E2E_DIR,
  E2E_UPLOADS_DIR,
  serverEnv,
  WEB_DIR,
} from "./env";

/**
 * Production-server lifecycle for the backend-down suite (ADR-0009): the
 * tests start the real bundled server and genuinely stop it, so "backend
 * unavailable" is a closed port, not a mock.
 */

const HEALTH_URL = `${E2E_BASE_URL}/api/v1/health`;
const START_TIMEOUT_MS = 90_000;
const STOP_TIMEOUT_MS = 15_000;

export function ensureBuilt(): void {
  if (!existsSync(DIST_SERVER_ENTRY)) {
    throw new Error(
      `Missing ${DIST_SERVER_ENTRY}. Build first: pnpm run build:web && pnpm run build:server (repo root).`
    );
  }
}

export function composeUp(): void {
  execSync("docker compose -f docker-compose.yml up -d --wait", {
    cwd: E2E_DIR,
    stdio: "inherit",
  });
}

export function composeDown(): void {
  execSync("docker compose -f docker-compose.yml down -v", {
    cwd: E2E_DIR,
    stdio: "ignore",
  });
}

async function isHealthy(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2_000) });

    return response.ok;
  } catch {
    return false;
  }
}

export interface E2eServer {
  stop(): Promise<void>;
}

export async function startServer(): Promise<E2eServer> {
  ensureBuilt();

  // A lingering listener (a crashed run, a manual debug server) would make
  // the suite talk to the wrong process; fail fast instead.
  if (await isHealthy()) {
    throw new Error(
      `something is already serving ${HEALTH_URL} — stop it before running the suite`
    );
  }

  mkdirSync(E2E_UPLOADS_DIR, { recursive: true });

  const child: ChildProcess = spawn(process.execPath, [DIST_SERVER_ENTRY], {
    cwd: WEB_DIR,
    env: serverEnv(),
    stdio: ["ignore", "inherit", "inherit"],
  });

  const exited = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });

  const deadline = Date.now() + START_TIMEOUT_MS;
  let up = false;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`e2e server exited early with code ${child.exitCode}`);
    }

    if (await isHealthy()) {
      up = true;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!up) {
    child.kill("SIGKILL");
    throw new Error(`e2e server did not become healthy within ${START_TIMEOUT_MS}ms`);
  }

  return {
    async stop() {
      if (child.exitCode !== null) return;

      child.kill("SIGTERM");

      const killTimer = setTimeout(() => child.kill("SIGKILL"), STOP_TIMEOUT_MS);

      await exited;
      clearTimeout(killTimer);

      // The port must actually be closed: a lingering listener would make
      // "backend down" a lie.
      while (await isHealthy()) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
  };
}
