/**
 * Shared environment for the production-like AI E2E harness.
 *
 * This suite boots the real production server bundle against its own dedicated
 * Postgres/Redis (see ./compose.yaml) and points the server's AI provider
 * at an in-harness fake provider (see ./ai-provider.ts). Everything except the
 * third-party AI HTTP call is genuinely exercised.
 *
 * Ports, database, and Redis are deliberately distinct from the backend-down
 * offline suite (apps/web/e2e) so the two suites never share state or collide.
 *
 * Prerequisites (once per checkout/build):
 *   pnpm run build:web && pnpm run build:server   # from the repo root
 *   pnpm --filter @norish/web run test:e2e:provenance
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROV_PORT = 3200;
export const PROV_BASE_URL = `http://localhost:${PROV_PORT}`;

export const PROV_DATABASE_URL = "postgresql://norish_prov:norish_prov@localhost:55433/norish_prov";
export const PROV_REDIS_URL = "redis://localhost:56380";

// The fake AI provider binds the loopback address; use 127.0.0.1 (not
// "localhost") so the server never resolves the endpoint to IPv6 and misses it.
export const FAKE_AI_PORT = 3199;
export const FAKE_AI_URL = `http://127.0.0.1:${FAKE_AI_PORT}`;

export const PROV_DIR = path.dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = path.resolve(PROV_DIR, "..");
export const REPO_ROOT = path.resolve(PROV_DIR, "../../..");
export const DIST_SERVER_ENTRY = path.join(REPO_ROOT, "dist-server/index.mjs");
export const PROV_UPLOADS_DIR = path.join(PROV_DIR, ".runtime/uploads");

/** User A signs up first, so it is the server owner (admin). */
export const USER_A = {
  email: "provenance-a@norish.test",
  password: "provenance-a-password-1",
  name: "Provenance A",
};
export const USER_B = {
  email: "provenance-b@norish.test",
  password: "provenance-b-password-1",
  name: "Provenance B",
};

export function serverEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PROV_PORT),
    DATABASE_URL: PROV_DATABASE_URL,
    REDIS_URL: PROV_REDIS_URL,
    AUTH_URL: PROV_BASE_URL,
    TRUSTED_ORIGINS: PROV_BASE_URL,
    // The committed test key from docker/docker-compose.test.yml. On a fresh
    // e2e database with no OAuth env, password auth + registration seed on.
    MASTER_KEY: "X4fjLgB8egCPwlOQW8iC3JGXAtUIMUOGmk/y29n+YSw=",
    UPLOADS_DIR: PROV_UPLOADS_DIR,
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
