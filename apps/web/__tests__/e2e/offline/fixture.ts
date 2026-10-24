import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

import type { SessionCookies } from "../harness/auth";
import { userIdOf } from "../harness/accounts";
import { signIn } from "../harness/auth";
import { hydratingBrowser } from "../harness/hydration";
import { ProductionStack } from "../harness/production-stack";
import { seedRecipe } from "../harness/recipes";
import { callTrpc } from "../harness/trpc";

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
export const SEEDED_RECIPE_DISH_COLOR = "#b05a2a";
export const SEEDED_GROCERY_NAME = "Warm Set Oat Milk";
export const SEEDED_NOTE_TITLE = "Warm Set Leftovers";
export const SEEDED_COOKBOOK_ID = "7e300351-13a4-4bfb-8b40-7a1a5a5f8d02";
export const SEEDED_COOKBOOK_TITLE = "Warm Set Breads";
/** A food the household keeps, so the Pantry has a row offline. */
export const SEEDED_PANTRY_FOOD = "warm set honey";
/** The warmed recipe's one line, a food the household does not keep. */
export const SEEDED_RECIPE_LINE = "warm set flour";
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

/** What the offline suite reads, written as user A through the app; only the recipe is not. */
async function seed(stack: ProductionStack, cookiesA: SessionCookies): Promise<void> {
  const asA = (procedure: string, input: unknown) =>
    callTrpc(stack.baseURL, cookiesA, procedure, input);

  await asA("pantry.add", { name: SEEDED_PANTRY_FOOD });
  // Through the repositories: the create path derives a Dish Colour from the image instead.
  await seedRecipe(await userIdOf(USER_A), SEEDED_RECIPE_NAME, [SEEDED_RECIPE_LINE], {
    id: SEEDED_RECIPE_ID,
    description: "Seeded for the Offline browser project.",
    dishColor: SEEDED_RECIPE_DISH_COLOR,
    servings: 4,
    images: [{ image: SEEDED_RECIPE_IMAGE, order: 0 }],
  });
  await asA("cookbooks.create", {
    id: SEEDED_COOKBOOK_ID,
    title: SEEDED_COOKBOOK_TITLE,
    recipeId: SEEDED_RECIPE_ID,
  });
  await asA("groceries.create", [{ name: SEEDED_GROCERY_NAME, unit: null, amount: 2 }]);
  // The browser's date, not the container's: the Postgres container runs UTC,
  // so its today is yesterday between local and UTC midnight.
  await asA("calendar.createItem", {
    date: new Date().toLocaleDateString("en-CA"),
    slot: "Dinner",
    itemType: "note",
    title: SEEDED_NOTE_TITLE,
  });

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

export const test = base.extend<Record<never, never>, OfflineWorkerFixtures>({
  browser: [async ({ browser }, use) => use(hydratingBrowser(browser)), { scope: "worker" }],
  offlineHarness: [
    async ({ browser }, use) => {
      const stack = new ProductionStack({
        project: "offline",
        databaseName: "norish_e2e",
        users: [USER_A, USER_B],
      });
      let context: BrowserContext | null = null;
      let stopUnresponsive: (() => Promise<void>) | null = null;

      try {
        await stack.start();
        const [cookiesA, cookiesB] = await Promise.all([
          signIn(stack.baseURL, USER_A),
          signIn(stack.baseURL, USER_B),
        ]);

        await seed(stack, cookiesA);

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
