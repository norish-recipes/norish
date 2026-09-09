/**
 * Capture the documentation screenshots for grocery aisles against a plain
 * Store the harness makes itself, so the pictures in the docs show the real app
 * and nothing outbound is involved.
 *
 * Not part of the gate. To re-capture: copy this file into
 * `apps/web/__tests__/e2e/ai/`, build (`rm -rf apps/web/.next && pnpm build:web
 * && pnpm build:server`), run `DOCS_SHOTS=1 pnpm exec playwright test --config
 * __tests__/e2e/playwright.config.ts --project=ai
 * __tests__/e2e/ai/docs-screenshots.e2e.ts` from `apps/web`, and delete the
 * copy again. Never run it in the same Playwright invocation as the grocery
 * scenarios: they share the worker's stack and database. Without DOCS_SHOTS
 * the pictures land in SHOTS_DIR only.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixture";
import { createPlainStore } from "./grocery-aisles-support";

test.describe.configure({ mode: "serial" });

const STORE = "Albert Heijn";
const SHOTS = process.env.SHOTS_DIR ?? path.resolve(import.meta.dirname, "../.runtime/shots");
const TAG = process.env.SHOTS_TAG ?? "aisles";
const DOCS = process.env.DOCS_SHOTS
  ? path.resolve(import.meta.dirname, "../../../../../apps/docs/static/img/screenshots")
  : null;

let page: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  mkdirSync(SHOTS, { recursive: true });
  await createPlainStore(STORE);

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    viewport: { width: 1100, height: 820 },
    deviceScaleFactor: 1.5,
    reducedMotion: "reduce",
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
});

/** A working picture, and the documentation's copy of it where it has one. */
async function snap(name: string, docsName?: string, fullPage = false): Promise<void> {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `${TAG}-${name}.png`), fullPage });
  if (DOCS && docsName) await page.screenshot({ path: path.join(DOCS, docsName), fullPage });
}

async function addGrocery(name: string): Promise<void> {
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

async function fileFromPanel(name: string, aisleName: string): Promise<void> {
  await page.getByText(name, { exact: true }).first().click();
  await page.getByTestId("aisle-selector").getByRole("button").click();
  await page.getByRole("option", { name: aisleName, exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("captures the store editor with its aisles", async () => {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).waitFor();
  await page.getByRole("button", { name: "View Mode" }).click();
  await page.getByRole("menuitem", { name: "Manage Stores" }).click();
  await page
    .getByRole("dialog", { name: "Manage Stores" })
    .getByRole("listitem")
    .filter({ hasText: STORE })
    .getByRole("button", { name: "Edit" })
    .click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeVisible();

  for (const aisle of ["Groente & fruit", "Brood", "Zuivel", "Vlees", "Diepvries"]) {
    await page.getByTestId("aisle-name").fill(aisle);
    await page.getByTestId("aisle-name").press("Enter");
  }
  await snap("store-editor", "groceries-aisles-editor.png");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeHidden();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("captures the list by aisle, with unfiled rows at the top", async () => {
  await page.goto("/groceries");
  for (const name of ["melk", "bananen", "yoghurt", "kipfilet", "volkorenbrood", "spinazie"]) {
    await addGrocery(name);
  }
  await fileFromPanel("melk", "Zuivel");
  await fileFromPanel("yoghurt", "Zuivel");
  await fileFromPanel("bananen", "Groente & fruit");
  await fileFromPanel("kipfilet", "Vlees");
  await fileFromPanel("volkorenbrood", "Brood");
  // "spinazie" stays unfiled, at the top, where it is noticed; "kipfilet" is
  // ticked, so the done tail shows under its own heading.
  await page
    .locator('[data-grocery-name="kipfilet"]')
    .first()
    .locator('[data-slot="checkbox"]')
    .click();
  await expect(page.getByTestId("done-heading")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("aisle-heading").first()).toBeVisible();
  await snap("list-desktop", "groceries-aisles-list.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId("aisle-heading").first()).toBeVisible();
  await snap("list-mobile", undefined, true);
  await page.setViewportSize({ width: 1100, height: 820 });
});

test("captures the grocery panel's Aisle field", async () => {
  await page.goto("/groceries");
  await page.getByText("spinazie", { exact: true }).first().click();
  await expect(page.getByTestId("aisle-selector")).toBeVisible();
  // The field where it sits, directly under the Store selector; the open
  // list of aisles is a working picture only.
  await snap("aisle-field", "groceries-aisle-field.png");
  await page.getByTestId("aisle-selector").getByRole("button").click();
  await expect(page.getByRole("option", { name: "Zuivel", exact: true })).toBeVisible();
  await snap("aisle-field-open");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
