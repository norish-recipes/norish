/**
 * Shared environment for the production-like AI E2E harness.
 *
 * This suite boots the real production server bundle against its own
 * Postgres/Redis, started by global setup via Testcontainers, and points the
 * server's AI provider at an in-harness fake provider (see ./ai-provider.ts).
 * Everything except the third-party AI HTTP call is genuinely exercised.
 *
 * The containers, database, and credentials are deliberately distinct from
 * the backend-down offline suite (apps/web/e2e) so the two suites never
 * share state; host ports are kernel-assigned so they can never collide.
 *
 * `pnpm run test:e2e` at the repo root builds and runs every browser suite in
 * one command. To run just this suite on an existing build (Docker running):
 *   pnpm run build:web && pnpm run build:server   # from the repo root
 *   pnpm --filter @norish/web run test:e2e:ai
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_PORT = 3200;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

// The fake AI provider binds the loopback address; use 127.0.0.1 (not
// "localhost") so the server never resolves the endpoint to IPv6 and misses it.
export const FAKE_AI_PORT = 3199;
export const FAKE_AI_URL = `http://127.0.0.1:${FAKE_AI_PORT}`;

export const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = path.resolve(E2E_DIR, "..");
export const REPO_ROOT = path.resolve(E2E_DIR, "../../..");
export const DIST_SERVER_ENTRY = path.join(REPO_ROOT, "dist-server/index.mjs");
export const E2E_UPLOADS_DIR = path.join(E2E_DIR, ".runtime/uploads");

/** User A signs up first, so it is the server owner (admin). */
export const USER_A = {
  email: "ai-e2e-a@norish.test",
  password: "ai-e2e-a-password-1",
  name: "Provenance A",
};
export const USER_B = {
  email: "ai-e2e-b@norish.test",
  password: "ai-e2e-b-password-1",
  name: "Provenance B",
};

const DATABASE_URL_VAR = "NORISH_AI_E2E_DATABASE_URL";
const REDIS_URL_VAR = "NORISH_AI_E2E_REDIS_URL";

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
    // Seed AI config (server-config seeding reads these on first boot) so the
    // server drives its real `generic-openai` provider against the fake one.
    AI_ENABLED: "true",
    AI_PROVIDER: "generic-openai",
    AI_ENDPOINT: FAKE_AI_URL,
    AI_MODEL: "test-model",
    AI_TEMPERATURE: "0",
    AI_MAX_TOKENS: "2048",
    // Keep the per-request timeout short so retryable/timeout scenarios don't
    // stall the suite waiting on the default 5-minute provider timeout.
    AI_TIMEOUT_MS: "30000",
  };
}
