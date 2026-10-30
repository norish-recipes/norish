import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

import { updateUserAvatar } from "@norish/db/repositories/users";

import type { SessionCookies } from "../harness/auth";
import { userIdOf } from "../harness/accounts";
import { signIn } from "../harness/auth";
import { BUILT_BASE_PATH } from "../harness/build";
import { hydratingBrowser } from "../harness/hydration";
import { ProductionStack } from "../harness/production-stack";
import { seedRecipe } from "../harness/recipes";
import { callTrpc } from "../harness/trpc";

export const OWNER = {
  email: "base-path-owner@norish.test",
  password: "base-path-owner-password-1",
  name: "Base Path Owner",
};
const MEMBER = {
  email: "base-path-member@norish.test",
  password: "base-path-member-password-1",
  name: "Base Path Member",
};

export const RECIPE_ID = "5b1e0a52-7c3d-4f1e-9a2b-3c4d5e6f7a81";
export const RECIPE_NAME = "Prefixed Pie";
export const GROCERY_NAME = "Prefixed Butter";
export const AVATAR = "base-path-owner.png";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
  "base64"
);

export interface BasePathHarness {
  /** The origin plus the base path, e.g. http://localhost:3400/norish. */
  readonly baseURL: string;
  readonly origin: string;
  readonly cookies: SessionCookies;
  readonly context: BrowserContext;
  readonly page: Page;
  /** Every same-origin request so far whose path left the base path. */
  readonly strays: string[];
  /** The absolute URL of an app path, which `page.goto("/x")` would resolve past the base path. */
  at(appPath: string): string;
}

function writeUpload(uploadsDir: string, relative: string): void {
  const file = path.join(uploadsDir, relative);

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, PNG_1X1);
}

/** A recipe with a photo and a step photo, planned for today, a grocery and an avatar. */
async function seed(stack: ProductionStack, cookies: SessionCookies): Promise<void> {
  const ownerId = await userIdOf(OWNER);

  await seedRecipe(ownerId, RECIPE_NAME, ["prefixed flour"], {
    id: RECIPE_ID,
    images: [{ image: `/recipes/${RECIPE_ID}/primary.png`, order: 0 }],
    steps: [
      {
        step: "Bake it.",
        order: 0,
        systemUsed: "metric",
        images: [{ image: `/recipes/${RECIPE_ID}/steps/step.png`, order: 0 }],
        stepIngredients: [],
      },
    ],
  });
  await callTrpc(stack.baseURL, cookies, "calendar.createItem", {
    date: new Date().toLocaleDateString("en-CA"),
    slot: "Dinner",
    itemType: "recipe",
    recipeId: RECIPE_ID,
  });
  await callTrpc(stack.baseURL, cookies, "groceries.create", [
    { name: GROCERY_NAME, unit: null, amount: 1 },
  ]);
  await updateUserAvatar(ownerId, `/avatars/${AVATAR}`);

  writeUpload(stack.uploadsDir, `recipes/${RECIPE_ID}/primary.png`);
  writeUpload(stack.uploadsDir, `recipes/${RECIPE_ID}/steps/step.png`);
  writeUpload(stack.uploadsDir, `avatars/${AVATAR}`);
}

export const test = base.extend<Record<never, never>, { basePath: BasePathHarness }>({
  browser: [async ({ browser }, use) => use(hydratingBrowser(browser)), { scope: "worker" }],
  basePath: [
    async ({ browser }, use) => {
      if (!BUILT_BASE_PATH) throw new Error("The base-path project needs a build with a base path");

      const stack = new ProductionStack({
        project: "base-path",
        databaseName: "norish_base_path_e2e",
        users: [OWNER, MEMBER],
      });
      let context: BrowserContext | null = null;

      try {
        await stack.start();

        const cookies = await signIn(stack.baseURL, OWNER);

        await seed(stack, cookies);
        context = await browser.newContext({
          serviceWorkers: "allow",
          storageState: { cookies, origins: [] },
        });

        const strays: string[] = [];

        context.on("request", (request) => {
          const url = new URL(request.url());
          const inside =
            url.pathname === BUILT_BASE_PATH || url.pathname.startsWith(`${BUILT_BASE_PATH}/`);

          if (url.origin === stack.origin && !inside) strays.push(url.pathname);
        });

        await use({
          baseURL: stack.baseURL,
          origin: stack.origin,
          cookies,
          context,
          page: await context.newPage(),
          strays,
          at: (appPath) => `${stack.baseURL}${appPath === "/" ? "" : appPath}`,
        });
      } finally {
        await Promise.allSettled([context?.close(), stack.stop()]);
      }
    },
    { scope: "worker" },
  ],
});

export { expect };
