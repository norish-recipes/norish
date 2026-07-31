/**
 * One-time environment preparation for the backend-down suite (ADR-0009):
 * bring up the dedicated e2e Postgres/Redis, boot the production server once
 * (it runs its own migrations), create the two test users through the real
 * auth API, and seed user A's Warm Set — a recipe with an on-disk primary
 * image, a grocery, and a planned calendar note — via SQL.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

import {
  E2E_BASE_URL,
  E2E_DATABASE_URL,
  E2E_DIR,
  E2E_UPLOADS_DIR,
  SEEDED_GROCERY_NAME,
  SEEDED_NOTE_TITLE,
  SEEDED_RECIPE_ID,
  SEEDED_RECIPE_IMAGE,
  SEEDED_RECIPE_NAME,
  USER_A,
  USER_B,
} from "./env";
import { composeDown, composeUp, ensureBuilt, startServer } from "./server";

// A 1x1 transparent PNG — enough for a real, decodable <img> render.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
  "base64"
);

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

async function seed(): Promise<void> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    // Emails are encrypted at rest (looked up by HMAC), so identify user A
    // structurally: the suite's sign-ups are the only users, A first — and A,
    // as first user, is the server owner.
    const users = await db.query<{ id: string }>(
      `select id from "user" where "isServerOwner" = true order by "createdAt" limit 1`
    );
    const userA = users.rows[0];

    if (!userA) throw new Error("user A missing after sign-up");

    // Idempotent re-runs: wipe A's seeded rows first.
    await db.query(`delete from planned_items where user_id = $1`, [userA.id]);
    await db.query(`delete from groceries where user_id = $1`, [userA.id]);
    await db.query(`delete from recipes where user_id = $1`, [userA.id]);

    await db.query(
      `insert into recipes (id, user_id, name, description, image, servings)
       values ($1, $2, $3, 'Seeded for the backend-down browser suite.', $4, 4)`,
      [SEEDED_RECIPE_ID, userA.id, SEEDED_RECIPE_NAME, SEEDED_RECIPE_IMAGE]
    );
    await db.query(
      `insert into groceries (user_id, name, unit, amount, is_done) values ($1, $2, null, 2, false)`,
      [userA.id, SEEDED_GROCERY_NAME]
    );
    await db.query(
      `insert into planned_items (user_id, date, slot, item_type, title)
       values ($1, current_date, 'Dinner', 'note', $2)`,
      [userA.id, SEEDED_NOTE_TITLE]
    );
  } finally {
    await db.end();
  }

  const imageDir = path.join(E2E_UPLOADS_DIR, "recipes", SEEDED_RECIPE_ID);

  mkdirSync(imageDir, { recursive: true });
  writeFileSync(path.join(imageDir, "primary.png"), PNG_1X1);
}

async function forceAuthConfig(): Promise<void> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

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
    cwd: E2E_DIR,
    stdio: "ignore",
  });
}

export default async function globalSetup(): Promise<void> {
  ensureBuilt();
  // Fresh volumes every run: user A must deterministically be the first
  // account (the server owner) and the seed idempotence stays trivial.
  composeDown();
  composeUp();

  // Boot #1 migrates and seeds server config. The developer .env can make
  // password auth seed to false (OAuth configured) and the auth provider
  // cache freezes that at boot, so the flags are forced in SQL and the
  // server is booted again to pick them up.
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
    await seed();
  } finally {
    await server.stop();
  }
}
