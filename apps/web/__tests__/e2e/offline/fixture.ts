import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";
import { Client } from "pg";

import type { SessionCookies } from "../harness/auth";
import { signIn } from "../harness/auth";
import { ProductionStack } from "../harness/production-stack";

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

type BackendState = "live" | "stopped" | "unresponsive";

export interface OfflineHarness {
  readonly baseURL: string;
  readonly context: BrowserContext;
  readonly page: Page;
  selectIdentity(identity: "a" | "b"): Promise<void>;
  transition(state: BackendState): Promise<void>;
}

interface OfflineWorkerFixtures {
  offlineHarness: OfflineHarness;
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
  "base64"
);

async function seed(stack: ProductionStack): Promise<void> {
  const database = new Client({ connectionString: stack.databaseUrl });

  await database.connect();

  try {
    const users = await database.query<{ id: string }>(
      `select id from "user" where "isServerOwner" = true order by "createdAt" limit 1`
    );
    const userA = users.rows[0];

    if (!userA) throw new Error("Offline owner missing after sign-up");

    await database.query(`delete from planned_items where user_id = $1`, [userA.id]);
    await database.query(`delete from groceries where user_id = $1`, [userA.id]);
    await database.query(`delete from recipes where user_id = $1`, [userA.id]);
    await database.query(
      `insert into recipes (id, user_id, name, description, image, servings)
       values ($1, $2, $3, 'Seeded for the Offline browser project.', $4, 4)`,
      [SEEDED_RECIPE_ID, userA.id, SEEDED_RECIPE_NAME, SEEDED_RECIPE_IMAGE]
    );
    await database.query(
      `insert into groceries (user_id, name, unit, amount, is_done) values ($1, $2, null, 2, false)`,
      [userA.id, SEEDED_GROCERY_NAME]
    );
    await database.query(
      `insert into planned_items (user_id, date, slot, item_type, title)
       values ($1, current_date, 'Dinner', 'note', $2)`,
      [userA.id, SEEDED_NOTE_TITLE]
    );
  } finally {
    await database.end();
  }

  const imageDir = path.join(stack.uploadsDir, "recipes", SEEDED_RECIPE_ID);

  mkdirSync(imageDir, { recursive: true });
  writeFileSync(path.join(imageDir, "primary.png"), PNG_1X1);
}

async function startBlackhole(port: number): Promise<() => Promise<void>> {
  const sockets = new Set<net.Socket>();
  const listener = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(port, resolve);
  });

  return () =>
    new Promise<void>((resolve, reject) => {
      for (const socket of sockets) socket.destroy();
      listener.close((error) => (error ? reject(error) : resolve()));
    });
}

async function cleanup(
  context: BrowserContext | null,
  stopBlackhole: (() => Promise<void>) | null,
  stack: ProductionStack
): Promise<void> {
  const results = await Promise.allSettled([
    context?.close() ?? Promise.resolve(),
    stopBlackhole?.() ?? Promise.resolve(),
    stack.stop(),
  ]);
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason);

  if (failures.length > 0) {
    throw new AggregateError(failures, "[offline] worker fixture cleanup failed");
  }
}

export const test = base.extend<Record<string, never>, OfflineWorkerFixtures>({
  offlineHarness: [
    async ({ browser }, use) => {
      const stack = new ProductionStack({
        project: "offline",
        port: 3100,
        databaseName: "norish_e2e",
        users: [USER_A, USER_B],
      });
      let context: BrowserContext | null = null;
      let stopUnresponsive: (() => Promise<void>) | null = null;

      try {
        await stack.start();
        await seed(stack);

        const [cookiesA, cookiesB] = await Promise.all([
          signIn(stack.baseURL, USER_A),
          signIn(stack.baseURL, USER_B),
        ]);

        context = await browser.newContext({ baseURL: stack.baseURL, serviceWorkers: "allow" });
        await context.addCookies(cookiesA);
        const page = await context.newPage();
        let state: BackendState = "live";

        const selectIdentity = async (identity: "a" | "b") => {
          await context!.clearCookies();
          await context!.addCookies(identity === "a" ? cookiesA : cookiesB);
        };
        const transition = async (next: BackendState) => {
          if (state === next) return;

          if (stopUnresponsive) {
            await stopUnresponsive();
            stopUnresponsive = null;
          }

          if (next === "live") {
            await stack.startServer();
          } else {
            await stack.stopServer();

            if (next === "unresponsive") {
              stopUnresponsive = await startBlackhole(Number(new URL(stack.baseURL).port));
            }
          }

          state = next;
        };

        await use({
          baseURL: stack.baseURL,
          context,
          page,
          selectIdentity,
          transition,
        });
      } finally {
        await cleanup(context, stopUnresponsive, stack);
      }
    },
    { scope: "worker" },
  ],
});

export { expect };
export type { SessionCookies };
