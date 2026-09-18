/**
 * Capture the documentation screenshots for Ingredient pictures against a
 * recipe the harness imports itself, with pictures uploaded through the
 * ingredients panel, so the docs show the real app and nothing outbound is
 * involved.
 *
 * Not part of the gate. To re-capture: copy this file into
 * `apps/web/__tests__/e2e/ai/`, build (`pnpm build:web && pnpm build:server`),
 * run `DOCS_SHOTS=1 pnpm exec playwright test --config
 * __tests__/e2e/playwright.config.ts --project=ai
 * __tests__/e2e/ai/docs-screenshots.e2e.ts` from `apps/web`, and delete the
 * copy again. Without DOCS_SHOTS the pictures land in SHOTS_DIR only.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import sharp from "sharp";

import { expect, test } from "./fixture";
import { submitPasteImport } from "./import-support";
import { resetIngredientPicturesScenario } from "./ingredient-pictures-support";

test.describe.configure({ mode: "serial" });

const SHOTS = process.env.SHOTS_DIR ?? path.resolve(import.meta.dirname, "../.runtime/shots");
const DOCS = process.env.DOCS_SHOTS
  ? path.resolve(import.meta.dirname, "../../../../docs/static/img/screenshots")
  : null;

const RECIPE = "Shakshuka";

/** Flat, outlined stand-ins in the style the illustration prompt asks for. */
const OUTLINE = `stroke="#3b2a20" stroke-width="10" stroke-linejoin="round"`;
const PICTURES: Record<string, string> = {
  Egg: `<ellipse cx="256" cy="276" rx="150" ry="190" fill="#f6ead7" ${OUTLINE}/><ellipse cx="206" cy="210" rx="36" ry="60" fill="#fff8ee"/>`,
  Tomato: `<circle cx="256" cy="286" r="170" fill="#e24a36" ${OUTLINE}/><path d="M256 116 l40 50 l60 -10 l-40 50 l20 50 l-80 -30 l-80 30 l20 -50 l-40 -50 l60 10z" fill="#4f9a3a" ${OUTLINE}/>`,
  Onion: `<path d="M256 90 C300 180 420 220 400 330 C385 420 310 450 256 450 C202 450 127 420 112 330 C92 220 212 180 256 90z" fill="#b8566e" ${OUTLINE}/><path d="M256 130 C230 230 200 330 256 450" fill="none" ${OUTLINE}/><path d="M256 130 C282 230 312 330 256 450" fill="none" ${OUTLINE}/>`,
  Garlic: `<path d="M256 80 C270 150 380 200 380 320 C380 410 320 450 256 450 C192 450 132 410 132 320 C132 200 242 150 256 80z" fill="#f3efe4" ${OUTLINE}/><path d="M256 170 C236 260 236 360 256 450 M200 230 C190 300 200 380 230 440 M312 230 C322 300 312 380 282 440" fill="none" ${OUTLINE}/>`,
  "Red pepper": `<path d="M170 170 C120 260 150 420 250 450 C350 470 400 330 370 220 C350 150 230 140 170 170z" fill="#d23a2a" ${OUTLINE}/><path d="M250 150 C250 110 270 80 300 70" fill="none" stroke="#4f9a3a" stroke-width="22" stroke-linecap="round"/>`,
};

async function pictureFile(name: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#ffffff"/>${PICTURES[name]}</svg>`;

  return {
    name: `${name}.png`,
    mimeType: "image/png",
    buffer: await sharp(Buffer.from(svg)).png().toBuffer(),
  };
}

function shakshuka() {
  return {
    name: RECIPE,
    description: "Eggs poached in a spiced tomato and pepper sauce.",
    notes: null,
    recipeYield: 2,
    prepTime: "PT10M",
    cookTime: "PT25M",
    totalTime: "PT35M",
    recipeIngredient: {
      metric: [
        "4 eggs",
        "400 g tomatoes",
        "1 red pepper",
        "1 onion",
        "2 cloves garlic",
        "1 tsp cumin",
      ],
      us: ["4 eggs", "14 oz tomatoes", "1 red pepper", "1 onion", "2 cloves garlic", "1 tsp cumin"],
    },
    recipeInstructions: {
      metric: ["Soften the onion, pepper and garlic.", "Add the tomatoes and cumin.", "Crack in the eggs and cover."],
      us: ["Soften the onion, pepper and garlic.", "Add the tomatoes and cumin.", "Crack in the eggs and cover."],
    },
    keywords: null,
    allergyIndications: [],
    categories: [],
    nutrition: { calories: null, fat: null, carbs: null, protein: null },
  };
}

let page: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  mkdirSync(SHOTS, { recursive: true });
  await resetIngredientPicturesScenario();

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    viewport: { width: 1100, height: 820 },
    deviceScaleFactor: 1.5,
    reducedMotion: "reduce",
  });

  page = await context.newPage();

  aiStack.ai.control.reset();
  aiStack.ai.control.enqueue({ kind: "success", content: JSON.stringify(shakshuka()) });
  aiStack.ai.control.setDefault(null);
  await page.goto("/");
  await submitPasteImport(page, `Recipe text for ${RECIPE}`);
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { level: 3, name: RECIPE })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
});

test.afterAll(async () => {
  await page?.context().close();
});

async function snap(name: string, fullPage = false): Promise<void> {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, name), fullPage });
  if (DOCS) await page.screenshot({ path: path.join(DOCS, name), fullPage });
}

/** The recipe's own ingredient names, each given a picture. */
const ENTRIES: Array<{ name: string; picture: string }> = [
  { name: "eggs", picture: "Egg" },
  { name: "tomatoes", picture: "Tomato" },
  { name: "onion", picture: "Onion" },
  { name: "garlic", picture: "Garlic" },
  { name: "red pepper", picture: "Red pepper" },
];

test("captures the ingredients panel and the editor", async () => {
  await page.goto("/settings?tab=admin");
  await page.getByTestId("ingredients-manage").click();

  for (const entry of ENTRIES) {
    await page.getByTestId("ingredients-search").fill(entry.name);

    const row = page.locator(
      `[data-testid="ingredients-row"][data-ingredient-name="${entry.name}"]`
    );

    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByTestId("ingredients-picture-file")).toBeAttached();
    await page
      .getByTestId("ingredients-picture-file")
      .setInputFiles(await pictureFile(entry.picture));
    await expect(
      page.getByRole("dialog").last().getByTestId("ingredient-illustration")
    ).toBeVisible();
    if (entry.name === "garlic") await snap("ingredients-admin-editor.png");

    await page.getByTestId("ingredients-save").click();
    await expect(page.getByTestId("ingredients-save")).toHaveCount(0);
  }

  await page.getByTestId("ingredients-search").fill("");
  await expect(page.getByTestId("ingredients-row")).toHaveCount(6);
  await snap("ingredients-admin-panel.png");
});

test("captures a recipe's ingredient list", async () => {
  await page.goto("/");
  await page.getByRole("heading", { level: 3, name: RECIPE }).click();
  await expect(page.getByTestId("ingredient-illustration").first()).toBeVisible();

  const list = page.getByTestId("ingredient-row").first().locator("xpath=ancestor::ul[1]");

  await list.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await list.screenshot({ path: path.join(SHOTS, "ingredient-pictures-recipe.png") });
  if (DOCS) {
    await list.screenshot({ path: path.join(DOCS, "ingredient-pictures-recipe.png") });
  }
});

test("captures an editor suggestion", async () => {
  await page.goto("/");
  await page.getByRole("heading", { level: 3, name: RECIPE }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  await page.goto(page.url().replace(/\/recipes\/([^/]+)$/, "/recipes/edit/$1"));

  const textareas = page.locator("textarea");
  let cuminRow = -1;

  await expect(async () => {
    const values = await textareas.evaluateAll((areas) =>
      areas.map((area) => (area as HTMLTextAreaElement).value)
    );

    cuminRow = values.findIndex((value) => /cumin$/.test(value));
    expect(cuminRow).toBeGreaterThanOrEqual(0);
  }).toPass({ timeout: 10_000 });

  const field = textareas.nth(cuminRow);

  await field.fill("1 tsp to");
  await expect(page.getByTestId("name-suggestion").first()).toBeVisible();

  const row = field.locator("xpath=ancestor::ul[1]");

  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const box = await row.boundingBox();

  if (!box) throw new Error("No ingredient list to capture");

  const clip = { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 200 };

  await page.screenshot({ path: path.join(SHOTS, "ingredient-pictures-editor.png"), clip });
  if (DOCS) await page.screenshot({ path: path.join(DOCS, "ingredient-pictures-editor.png"), clip });
});
