/**
 * The landing tour's groceries captures, taken off the E2E production stack
 * against the harness's own shop: no dev login is needed and no real
 * supermarket is visited. Not part of the gate. To re-capture: copy this file
 * into `apps/web/__tests__/e2e/ai/`, build (`rm -rf apps/web/.next && pnpm
 * build:web && pnpm build:server`), then from `apps/web`:
 *
 *   AVATAR_PATH=<png> pnpm exec playwright test -c __tests__/e2e/playwright.config.ts \
 *     --project=ai __tests__/e2e/ai/landing-shots.e2e.ts
 *
 * and delete the copy again. AVATAR_PATH is the household's avatar (the dog
 * of the other tour captures, cropped out of dashboard-web-light.jpg).
 *
 * The pictures land in apps/landing/assets/screenshots (or SHOTS_DIR) at the
 * sizes assets/screenshots/README.md asks for; then run
 * `pnpm --filter @norish/landing shots`.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { Client } from "pg";

import type { FakeShop } from "../harness/fake-shop";
import { createFakeShop } from "../harness/fake-shop";
import { databaseUrl } from "./database";
import { expect, test } from "./fixture";
import { createPlainStore } from "./grocery-aisles-support";
import { createShopStore } from "./grocery-prices-support";

test.describe.configure({ mode: "serial" });

const OUT =
  process.env.SHOTS_DIR ??
  path.resolve(import.meta.dirname, "../../../../../apps/landing/assets/screenshots");
const AVATAR = process.env.AVATAR_PATH;
const FORMS = {
  web: { width: 900, height: 675 },
  mobile: { width: 390, height: 773 },
} as const;
const SHOP_STORE = "Dirk";
const OTHER_STORE = "Albert Heijn";

let shop: FakeShop;
let page: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  mkdirSync(OUT, { recursive: true });
  shop = createFakeShop();
  await shop.start();
  const dirk = await createShopStore(SHOP_STORE, shop.url);
  const other = await createPlainStore(OTHER_STORE);
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();
  try {
    await database.query(`update stores set color = 'danger' where id = $1`, [dirk]);
    await database.query(`update stores set color = 'sky' where id = $1`, [other]);
    const aisleIds = new Map<string, string>();

    for (const [index, name] of ["Groente & fruit", "Zuivel", "Brood"].entries()) {
      const inserted = await database.query<{ id: string }>(
        `insert into aisles (store_id, name, sort_order) values ($1, $2, $3) returning id`,
        [dirk, name, index]
      );

      aisleIds.set(name, inserted.rows[0]!.id);
    }
    const filing: [string, string][] = [
      ["bananen los", "Groente & fruit"],
      ["halfvolle melk", "Zuivel"],
      ["oude kaas", "Zuivel"],
      ["geitenkaas plakken", "Zuivel"],
      ["roomboter", "Zuivel"],
      ["bruin brood", "Brood"],
    ];

    for (const [name, aisle] of filing) {
      await database.query(
        `insert into aisle_links (store_id, normalized_name, aisle_id) values ($1, $2, $3)`,
        [dirk, name, aisleIds.get(aisle)]
      );
    }
  } finally {
    await database.end();
  }

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    viewport: { width: 1100, height: 1000 },
    reducedMotion: "reduce",
  });

  context.setDefaultTimeout(20_000);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
  await shop?.stop();
});

async function addGrocery(name: string, storeName: string, shown: string = name): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  // A rhythm the name suggests is a suggestion until it is tapped.
  const suggestion = page
    .getByRole("dialog")
    .getByText(/every week/i)
    .first();

  if (await suggestion.isVisible().catch(() => false)) {
    await suggestion.click();
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: /Auto-detect from history|Dirk|Albert Heijn/ }).click();
  await page.getByRole("option", { name: storeName }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(shown, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("wears the household's avatar", async () => {
  if (!AVATAR) return;
  await page.goto("/settings");
  const input = page.locator('input[type="file"][accept="image/*"]').first();

  // The input is hidden; the avatar button before it opens the chooser, and
  // going through the chooser is what reaches the form's own change handler.
  const avatarButton = input.locator("xpath=preceding-sibling::button[1]");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), avatarButton.click()]);

  await chooser.setFiles(AVATAR);
  // The profile card's own Save, not another card's: the innermost block
  // holding both the file input and a Save button.
  const card = page
    .locator("div")
    .filter({ has: input })
    .filter({ has: page.getByRole("button", { name: "Save Changes" }) })
    .last();
  const save = card.getByRole("button", { name: "Save Changes" });

  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled({ timeout: 20_000 });
  await page.waitForTimeout(1000);
  await page.goto("/groceries");
  await expect(page.locator("nav img, header img").first())
    .toBeVisible({ timeout: 15_000 })
    .catch(() => console.warn("  ! no avatar image in the nav after the upload"));
});

test("seeds the week's shopping", async () => {
  await addGrocery("halfvolle melk every week", SHOP_STORE, "halfvolle melk");
  await addGrocery("700 g bananen los", SHOP_STORE, "bananen los");
  await addGrocery("oude kaas", SHOP_STORE);
  await addGrocery("300 g geitenkaas plakken", SHOP_STORE, "geitenkaas plakken");
  await addGrocery("2 bruin brood", SHOP_STORE, "bruin brood");
  await addGrocery("roomboter", SHOP_STORE);
  await addGrocery("spinazie", OTHER_STORE);
  await addGrocery("yoghurt", OTHER_STORE);

  await expect
    .poll(
      async () => {
        await page.reload();
        await page.waitForTimeout(1500);

        return page.getByTestId("grocery-price").count();
      },
      { timeout: 120_000 }
    )
    .toBeGreaterThanOrEqual(6);

  // One thing already in the trolley.
  await page
    .locator('[data-grocery-name="roomboter"]')
    .first()
    .locator('[data-slot="checkbox-control"]')
    .first()
    .click();
  await expect(page.getByTestId("done-heading").first()).toBeVisible();
  await page.waitForTimeout(1500);
});

test("captures the groceries screen, web and mobile, light and dark", async ({
  browser,
  aiStack,
}) => {
  for (const [form, viewport] of Object.entries(FORMS)) {
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        baseURL: aiStack.baseURL,
        storageState: { cookies: aiStack.ownerCookies, origins: [] },
        viewport,
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
        colorScheme: theme,
      });
      const shot = await context.newPage();

      await shot.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
      await shot.goto("/groceries", { waitUntil: "networkidle" }).catch(() => {});
      await expect(shot.getByTestId("grocery-price").first()).toBeVisible({ timeout: 30_000 });
      await shot
        .waitForFunction(() => [...document.images].every((image) => image.complete), undefined, {
          timeout: 15_000,
        })
        .catch(() => {});
      await shot.waitForTimeout(1500);
      await shot.screenshot({
        path: path.join(OUT, `groceries-${form}-${theme}.jpg`),
        type: "jpeg",
        quality: 92,
      });
      console.log("captured", `groceries-${form}-${theme}`);
      await context.close();
    }
  }
});
