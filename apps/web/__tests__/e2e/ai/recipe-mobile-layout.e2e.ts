/**
 * The phone recipe layout and its cooking mode, end to end (ticket 13 of
 * .scratch/recipe-mobile-layout): the Glance Bar answers above the fold, the
 * cards follow cooking order, the floating cook pill stays reachable and
 * covers nothing it must not, cooking mode pages its steps with both swipes
 * and a visible way back, Ready At exists only inside a Cooking Session, and
 * a Hidden Item leaves the Glance Bar with the card.
 *
 * The tint opt-out is deliberately not covered here — ticket 15 owns it, and
 * its no-flash paths live in the offline project.
 */
import type { BrowserContext, Page } from "@playwright/test";
import { request } from "@playwright/test";
import { Client } from "pg";

import type { AIE2EStack } from "./fixture";
import { databaseUrl } from "./database";
import { expect, test } from "./fixture";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

const PHONE_VIEWPORT = { width: 390, height: 844 };

const RECIPE = {
  name: "Phone Layout Bake",
  description: "A deterministic recipe for the phone layout spec.",
  url: "https://example.com/phone-layout-bake",
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 20,
  totalMinutes: 45,
  calories: 640,
  // Numeric columns travel as strings through the insert contract.
  fat: "20",
  carbs: "70",
  protein: "30",
  systemUsed: "metric",
  recipeIngredients: [
    { ingredientName: "Strong flour", ingredientId: null, amount: 500, unit: "g", order: 0 },
    { ingredientName: "Lukewarm water", ingredientId: null, amount: 320, unit: "ml", order: 1 },
  ],
  steps: [
    { step: "Mix the flour and water into a shaggy dough.", order: 0, systemUsed: "metric" },
    { step: "Rest the dough for 40 minutes under a cloth.", order: 1, systemUsed: "metric" },
    { step: "Bake until deep brown and hollow-sounding.", order: 2, systemUsed: "metric" },
  ],
  tags: [],
  cuisines: [],
  categories: ["Dinner"],
  images: [],
  videos: [],
};

let stack: AIE2EStack;
let context: BrowserContext;
let page: Page;
let recipeId: string;

/** Touch-flavoured swipe: the handlers deliberately ignore mouse pointers. */
async function swipe(deltaX: number, deltaY: number): Promise<void> {
  // The pointer handlers live on cooking mode's content area — the shell's
  // middle flex cell; the dialog's is the last one mounted.
  await page
    .locator("div.min-h-0.flex-1.overflow-hidden")
    .last()
    .evaluate(
      (element, delta) => {
        const rect = element.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;
        const options = { bubbles: true, cancelable: true, pointerType: "touch" as const };

        element.dispatchEvent(
          new PointerEvent("pointerdown", { ...options, clientX: startX, clientY: startY })
        );
        element.dispatchEvent(
          new PointerEvent("pointerup", {
            ...options,
            clientX: startX + delta.x,
            clientY: startY + delta.y,
          })
        );
      },
      { x: deltaX, y: deltaY }
    );
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test.beforeAll(async ({ aiStack, browser }) => {
  stack = aiStack;
  await setAutomaticEnrichment({});

  // Everything the spec asserts is phone behaviour, so the shared desktop
  // context stays unused and this suite drives its own phone-sized one.
  context = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: stack.ownerCookies, origins: [] },
    serviceWorkers: "allow",
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
  });
  page = await context.newPage();

  // Seed through the same mutation the recipe form uses: full control over
  // times, servings, nutrition and source, no AI involved.
  const api = await request.newContext({
    baseURL: stack.baseURL,
    extraHTTPHeaders: {
      origin: stack.baseURL,
      cookie: stack.ownerCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  try {
    const response = await api.post("/api/trpc/recipes.create", {
      data: { json: RECIPE },
    });

    if (!response.ok()) throw new Error(`recipes.create failed: ${response.status()}`);

    const body = (await response.json()) as { result: { data: { json: string } } };

    recipeId = body.result.data.json;
  } finally {
    await api.dispose();
  }

  // The mutation answers before the transaction lands; wait for the rows.
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();
  try {
    await expect
      .poll(
        async () => {
          const rows = await database.query("select 1 from steps where recipe_id = $1", [recipeId]);

          return rows.rowCount;
        },
        { timeout: 30_000 }
      )
      .toBe(RECIPE.steps.length);
  } finally {
    await database.end();
  }
});

test.afterAll(async () => {
  await context?.close();
});

test("the Glance Bar answers above the fold and the cards follow cooking order", async () => {
  await page.goto(`/recipes/${recipeId}`);

  const glanceBar = page.getByTestId("glance-bar");

  await expect(glanceBar).toBeVisible();
  await expect(glanceBar).toContainText("45m");
  await expect(glanceBar).toContainText("4");
  await expect(glanceBar).toContainText("640");

  // Above the fold: the whole answer arrives before any scrolling.
  const barBox = await glanceBar.boundingBox();

  expect(barBox).not.toBeNull();
  expect(barBox!.y + barBox!.height).toBeLessThan(PHONE_VIEWPORT.height);

  // Card order on the phone tree (the hidden desktop tree keeps its own
  // headings, so only visible ones count). No notes and no provenance are
  // stored, so neither card renders — a bare section is a shorter page.
  await expect(page.locator("h2:visible")).toHaveText([
    "Ingredients",
    "Steps",
    "Cooking time",
    "Nutrition",
    "Source",
    // Last on the page, and always drawn: with no cookbooks it is the
    // invitation to file the recipe into one.
    "In cookbooks",
  ]);
});

test("the cook pill stays reachable at full scroll and covers neither nav nor timers", async () => {
  // A running timer first, so the corner the dock rises into is occupied.
  // Both page trees render the chip; only the phone tree's copy is visible.
  const timerChip = page.getByText("40 minutes").locator("visible=true").first();

  await timerChip.scrollIntoViewIfNeeded();
  await timerChip.click();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);

  const cookPill = page.getByRole("button", { name: "Cook", exact: true });

  await expect(cookPill).toBeVisible();

  const cookBox = await cookPill.boundingBox();
  const navBox = await page.locator("div.z-\\[60\\] ul >> visible=true").last().boundingBox();

  expect(cookBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(boxesOverlap(cookBox!, navBox!)).toBe(false);

  // The timer dock floats in the opposite corner; the pill must not sit on
  // it. The collapsed dock is the button carrying the mono countdown.
  const dock = page
    .locator("button")
    .filter({ has: page.locator("span.font-mono") })
    .last();

  await expect(dock).toBeVisible();

  const dockBox = await dock.boundingBox();

  expect(boxesOverlap(cookBox!, dockBox!)).toBe(false);
});

test("cooking mode pages its steps, keeps both swipes, and projects Ready At only there", async () => {
  await page.getByRole("button", { name: "Cook", exact: true }).click();

  // Everything cooking mode shows is asserted inside its dialog — the page
  // trees underneath keep their own copies of most of these strings.
  const dialog = page.getByRole("dialog");

  // Step one fills the page; the next step peeks, faded, at the bottom edge.
  await expect(dialog.getByText(RECIPE.steps[0]!.step).first()).toBeVisible();
  await expect(dialog.locator('[data-cooking-step-peek="bottom"]')).toContainText("Rest the dough");
  await expect(dialog.getByText(/Ready around/)).toBeVisible();
  await expect(dialog.getByText("1 / 3")).toBeVisible();

  // The vertical swipe pages forward.
  await swipe(0, -120);
  await expect(dialog.getByText("2 / 3")).toBeVisible();

  // The visible way back for a cook who never discovers the gesture.
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await expect(dialog.getByText("1 / 3")).toBeVisible();

  // The horizontal swipe reaches the ingredients and comes back.
  await swipe(-120, 0);
  await expect(dialog.getByText("Strong flour").first()).toBeVisible();
  await swipe(120, 0);
  await expect(dialog.getByText(RECIPE.steps[0]!.step).first()).toBeVisible();

  // Ready At belongs to the Cooking Session alone: closing it ends the
  // session, and the recipe page makes no claim.
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText(/Ready around/)).toHaveCount(0);
});

test("hiding Nutrition Information takes the card and the Glance Bar's calories together", async () => {
  await context.addCookies([
    { name: "norish_hidden_items", value: "nutrition", url: stack.baseURL },
  ]);

  await page.goto(`/recipes/${recipeId}`);

  const glanceBar = page.getByTestId("glance-bar");

  await expect(glanceBar).toBeVisible();
  await expect(glanceBar).toContainText("45m");
  await expect(glanceBar).not.toContainText("640");
  await expect(page.locator("h2:visible").filter({ hasText: "Nutrition" })).toHaveCount(0);
});
