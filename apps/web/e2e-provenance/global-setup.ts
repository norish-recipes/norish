/**
 * One-time environment preparation for the production-like AI E2E harness:
 * bring up the dedicated Postgres/Redis, boot the production server once (it
 * runs its own migrations and seeds AI config from the harness env, so the
 * feature is enabled and pointed at the fake provider), then create the two
 * test users through the real auth API.
 *
 * No recipe/grocery seeding: provenance scenarios create their own recipes by
 * importing, which is exactly the path under test.
 */
import { execSync } from "node:child_process";
import { Client } from "pg";

import { PROV_BASE_URL, PROV_DATABASE_URL, PROV_DIR, USER_A, USER_B } from "./env";
import { composeDown, composeUp, ensureBuilt, startServer } from "./server";

async function signUp(user: { email: string; password: string; name: string }): Promise<void> {
  const response = await fetch(`${PROV_BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    // Better Auth rejects auth POSTs without a trusted Origin.
    headers: { "content-type": "application/json", origin: PROV_BASE_URL },
    body: JSON.stringify(user),
  });

  // 422/400 with an existing account is fine on re-runs; anything else is not.
  if (!response.ok && response.status !== 422 && response.status !== 400) {
    const body = await response.text().catch(() => "<unreadable>");

    throw new Error(`sign-up for ${user.email} failed: ${response.status} ${body}`);
  }
}

async function forceAuthConfig(): Promise<void> {
  const db = new Client({ connectionString: PROV_DATABASE_URL });

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
  execSync("docker compose -f compose.yaml exec -T redis redis-cli flushall", {
    cwd: PROV_DIR,
    stdio: "ignore",
  });
}

export default async function globalSetup(): Promise<void> {
  ensureBuilt();
  // Fresh volumes every run: user A must deterministically be the first account
  // (the server owner) and re-runs stay trivially isolated.
  composeDown();
  composeUp();

  // Boot #1 migrates and seeds server config. The developer environment can make
  // password auth seed to false (OAuth configured) and the auth provider cache
  // freezes that at boot, so the flags are forced in SQL and the server is
  // rebooted to pick them up.
  const bootstrap = await startServer();

  await bootstrap.stop();
  await forceAuthConfig();

  const server = await startServer();

  try {
    await signUp(USER_A);
    // The first user's registration hook turns registration off; re-enable it
    // for the second account (the check is a live read).
    await forceAuthConfig();
    await signUp(USER_B);
  } finally {
    await server.stop();
  }
}
