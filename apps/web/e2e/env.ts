/**
 * Shared environment for the backend-down browser suite (ADR-0009).
 *
 * The suite runs the production server bundle against its own Postgres/Redis,
 * started by global setup via Testcontainers, on its own port so a running
 * dev server never interferes. `pnpm run test:e2e` at the repo root builds
 * and runs every browser suite in one command; to run just this suite on an
 * existing build (Docker running):
 *
 *   pnpm run build:web && pnpm run build:server   # from the repo root
 *   pnpm --filter @norish/web run test:e2e
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = path.resolve(E2E_DIR, "..");
export const REPO_ROOT = path.resolve(E2E_DIR, "../../..");
export const DIST_SERVER_ENTRY = path.join(REPO_ROOT, "dist-server/index.mjs");
export const E2E_UPLOADS_DIR = path.join(E2E_DIR, ".runtime/uploads");

export const USER_A = {
  email: "offline-a@norish.test",
  password: "offline-a-password-1",
  name: "Offline A",
};
export const USER_B = {
  email: "offline-b@norish.test",
  password: "offline-b-password-1",
  name: "Offline B",
};

export const SEEDED_RECIPE_ID = "7e300351-13a4-4bfb-8b40-7a1a5a5f8d01";
export const SEEDED_RECIPE_NAME = "Warm Set Focaccia";
export const SEEDED_RECIPE_IMAGE = `/recipes/${SEEDED_RECIPE_ID}/primary.png`;
export const SEEDED_GROCERY_NAME = "Warm Set Oat Milk";
export const SEEDED_NOTE_TITLE = "Warm Set Leftovers";
export const UNWARMED_RECIPE_ID = "44444444-4444-4444-8444-444444444444";

const DATABASE_URL_VAR = "NORISH_E2E_DATABASE_URL";
const REDIS_URL_VAR = "NORISH_E2E_REDIS_URL";

/**
 * Global setup starts Postgres/Redis via Testcontainers on kernel-assigned
 * host ports (a fixed port can already be taken — that made the old
 * `compose up` flake in CI with "address already in use") and publishes the
 * URLs here; the production-server child and the Playwright workers inherit
 * them through the environment.
 */
export function exportStackUrls(urls: { databaseUrl: string; redisUrl: string }): void {
  process.env[DATABASE_URL_VAR] = urls.databaseUrl;
  process.env[REDIS_URL_VAR] = urls.redisUrl;
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is unset — global setup exports it once the suite's containers are up`
    );
  }

  return value;
}

export function e2eDatabaseUrl(): string {
  return requiredEnv(DATABASE_URL_VAR);
}

export function e2eRedisUrl(): string {
  return requiredEnv(REDIS_URL_VAR);
}

export function serverEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(E2E_PORT),
    DATABASE_URL: e2eDatabaseUrl(),
    REDIS_URL: e2eRedisUrl(),
    AUTH_URL: E2E_BASE_URL,
    TRUSTED_ORIGINS: E2E_BASE_URL,
    // The committed test key from docker/docker-compose.test.yml. On a fresh
    // e2e database with no OAuth env, password auth + registration seed on.
    MASTER_KEY: "X4fjLgB8egCPwlOQW8iC3JGXAtUIMUOGmk/y29n+YSw=",
    UPLOADS_DIR: E2E_UPLOADS_DIR,
    LOG_LEVEL: "warn",
  };
}
