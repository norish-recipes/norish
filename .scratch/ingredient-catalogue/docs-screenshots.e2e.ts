/**
 * Capture the documentation screenshots for the Ingredients page against a
 * small catalogue the harness seeds itself, so the pictures in the docs show
 * the real app and nothing outbound is involved.
 *
 * Not part of the gate. To re-capture: copy this file into
 * `apps/web/__tests__/e2e/ai/`, build (`rm -rf apps/web/.next && pnpm build:web
 * && pnpm build:server`), run `DOCS_SHOTS=1 pnpm exec playwright test --config
 * __tests__/e2e/playwright.config.ts --project=ai
 * __tests__/e2e/ai/docs-screenshots.e2e.ts` from `apps/web`, and delete the
 * copy again. Never run it in the same Playwright invocation as the other
 * scenarios: they share the worker's stack and database. Without DOCS_SHOTS
 * the pictures land in SHOTS_DIR only.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";

import { withDatabase } from "./database";
import { expect, test } from "./fixture";
import { resetCatalogueScenario, seedCatalogue } from "./ingredient-catalogue-support";

test.describe.configure({ mode: "serial" });

const SHOTS = process.env.SHOTS_DIR ?? path.resolve(import.meta.dirname, "../.runtime/shots");
const TAG = process.env.SHOTS_TAG ?? "ingredients";
const DOCS = process.env.DOCS_SHOTS
  ? path.resolve(import.meta.dirname, "../../../../../apps/docs/static/img/screenshots")
  : null;

let page: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  mkdirSync(SHOTS, { recursive: true });
  await resetCatalogueScenario();

  const ids = await seedCatalogue([
    {
      name: "garlic",
      aliases: [
        { text: "garlic", locale: "en" },
        { text: "knoflook", locale: "nl" },
        { text: "ail", locale: "fr" },
      ],
    },
    {
      name: "onion",
      aliases: [
        { text: "onion", locale: "en" },
        { text: "onions", locale: "en" },
        { text: "ui", locale: "nl" },
        { text: "uien", locale: "nl" },
        { text: "oignon", locale: "fr" },
        { text: "zwiebel", locale: "de" },
        { text: "cebolla", locale: "es" },
      ],
    },
    {
      name: "red onion",
      aliases: [
        { text: "red onion", locale: "en" },
        { text: "rode ui", locale: "nl" },
      ],
    },
    { name: "uitjes", aliases: [{ text: "uitjes", locale: "nl" }], flagged: true },
  ]);

  await withDatabase((database) =>
    database.query(`update ingredients set parent_id = $1, parent_chosen = true where id = $2`, [
      ids.onion,
      ids["red onion"],
    ])
  );

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    viewport: { width: 1100, height: 900 },
    deviceScaleFactor: 1.5,
    reducedMotion: "reduce",
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
});

/** A working picture of one element, and the documentation's copy of it where it has one. */
async function snap(target: Locator, name: string, docsName?: string): Promise<void> {
  await page.waitForTimeout(500);
  await target.screenshot({ path: path.join(SHOTS, `${TAG}-${name}.png`) });
  if (DOCS && docsName) await target.screenshot({ path: path.join(DOCS, docsName) });
}

function row(name: string): Locator {
  return page.locator(`[data-testid="ingredient-row"][data-ingredient="${name}"]`);
}

test("captures the Ingredients page", async () => {
  await page.goto("/settings?tab=ingredients");
  await expect(row("uitjes")).toBeVisible();
  await snap(page.getByTestId("ingredients-list").locator(".."), "page", "ingredients-page.png");
});

test("captures a flagged ingredient's panel", async () => {
  await row("uitjes").getByTestId("ingredient-toggle").click();
  const opened = page.getByRole("dialog", { name: "uitjes", exact: true });

  await expect(opened.getByTestId("ingredient-flag-notice")).toBeVisible();
  await snap(opened, "panel", "ingredients-panel.png");
});

test("captures merging a flagged ingredient", async () => {
  await page
    .getByRole("dialog", { name: "uitjes", exact: true })
    .getByTestId("ingredient-merge")
    .click();
  const asking = page.getByRole("dialog", { name: "Merge into…" });

  await asking.getByTestId("ingredient-picker").fill("onio");
  await page.getByRole("option", { name: "onion", exact: true }).click();
  await expect(asking.getByTestId("ingredient-relocation-confirm")).toBeEnabled();
  await snap(asking, "merge", "ingredients-merge.png");
});

test("captures the Data sources section", async () => {
  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("data-sources").scrollIntoViewIfNeeded();
  await snap(page.getByTestId("data-sources"), "data-sources", "ingredients-data-sources.png");
});
