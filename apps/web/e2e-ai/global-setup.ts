/**
 * One-time environment preparation for the production-like AI E2E harness:
 * start the suite's own Postgres/Redis via Testcontainers, boot the
 * production server once (it runs its own migrations and seeds AI config
 * from the harness env, so the feature is enabled and pointed at the fake
 * provider), then create the two test users through the real auth API.
 *
 * No recipe/grocery seeding: scenarios create their own recipes by
 * importing, which is exactly the path under test.
 */
import type { StartedRedisContainer } from "@testcontainers/redis";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { Client } from "pg";

import { E2E_BASE_URL, e2eDatabaseUrl, exportStackUrls, USER_A, USER_B } from "./env";
import { ensureBuilt, startServer } from "./server";

async function signUp(user: { email: string; password: string; name: string }): Promise<void> {
  const response = await fetch(`${E2E_BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    // Better Auth rejects auth POSTs without a trusted Origin.
    headers: { "content-type": "application/json", origin: E2E_BASE_URL },
    body: JSON.stringify(user),
  });

  // 422/400 with an existing account is fine on re-runs; anything else is not.
  if (!response.ok && response.status !== 422 && response.status !== 400) {
    const body = await response.text().catch(() => "<unreadable>");

    throw new Error(`sign-up for ${user.email} failed: ${response.status} ${body}`);
  }
}

async function forceAuthConfig(redis: StartedRedisContainer): Promise<void> {
  const db = new Client({ connectionString: e2eDatabaseUrl() });

  await db.connect();

  try {
    await db.query(
      `update server_config set value = 'true'::jsonb
       where key in ('password_auth_enabled', 'registration_enabled')`
    );
  } finally {
    await db.end();
  }

  // getConfig reads may be Redis-cached; drop them so the SQL value wins.
  await redis.executeCliCmd("flushall");
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  ensureBuilt();

  // Fresh anonymous containers every run: user A must deterministically be
  // the first account (the server owner) and re-runs stay trivially
  // isolated. Testcontainers publishes on kernel-assigned host ports (a
  // fixed port can already be taken — that flaked CI with "address already
  // in use") and its reaper removes the containers even after a crashed run.
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer("postgres:17-alpine")
      .withDatabase("norish_ai_e2e")
      .withUsername("norish_ai_e2e")
      .withPassword("norish_ai_e2e")
      .start(),
    new RedisContainer("redis:8.6.2-alpine").start(),
  ]);

  exportStackUrls({
    databaseUrl: postgres.getConnectionUri(),
    redisUrl: redis.getConnectionUrl(),
  });

  // Boot #1 migrates and seeds server config. The developer environment can make
  // password auth seed to false (OAuth configured) and the auth provider cache
  // freezes that at boot, so the flags are forced in SQL and the server is
  // rebooted to pick them up.
  const bootstrap = await startServer();

  await bootstrap.stop();
  await forceAuthConfig(redis);

  const server = await startServer();

  try {
    await signUp(USER_A);
    // The first user's registration hook turns registration off; re-enable it
    // for the second account (the check is a live read).
    await forceAuthConfig(redis);
    await signUp(USER_B);
  } finally {
    await server.stop();
  }

  return async () => {
    await Promise.all([postgres.stop(), redis.stop()]);
  };
}
