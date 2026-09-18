/**
 * Ingredient pictures through a real browser, a real server, and the fake AI
 * provider's image route (ADR-0037).
 *
 * What a reader and an administrator actually do: a recipe is imported; an
 * administrator finds one of its ingredients and has its picture drawn; the
 * picture then shows beside that recipe's line, beside a grocery typed by
 * hand, and in the editor's suggestions — while a line whose name matches
 * nothing stays plain text, and an ingredient a recipe uses cannot be deleted.
 * Only the AI provider's HTTP boundary is faked.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { expect, test } from "./fixture";
import { configureImageGeneration } from "./image-generation-support";
import { submitPasteImport } from "./import-support";
import { readIngredient, resetIngredientPicturesScenario } from "./ingredient-pictures-support";

test.describe.configure({ mode: "serial" });

const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");
/** Any real picture will do: the drawing is cropped to a square on the way in. */
const DRAWN_PICTURE_BASE64 = readFileSync(path.join(FIXTURES_DIR, "generated-dish.jpg")).toString(
  "base64"
);

const RECIPE = "Chive Omelette";
const SECOND_RECIPE = "Egg Omelette";

function omeletteRecipe() {
  return {
    name: RECIPE,
    description: null,
    notes: null,
    recipeYield: 1,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    recipeIngredient: {
      metric: ["3 eggs", "1 hen egg", "5 g chives"],
      us: ["3 eggs", "1 hen egg", "1 tbsp chives"],
    },
    recipeInstructions: {
      metric: ["Beat the eggs.", "Cook gently and fold."],
      us: ["Beat the eggs.", "Cook gently and fold."],
    },
    keywords: null,
    allergyIndications: [],
    categories: [],
    nutrition: { calories: null, fat: null, carbs: null, protein: null },
  };
}

let stack: AIE2EStack;
let page: Page;

test.beforeEach(({ aiStack, page: testPage }) => {
  stack = aiStack;
  page = testPage;
});

test.afterAll(async () => {
  await configureImageGeneration(null);
});

async function importOmelette(): Promise<void> {
  const { ai } = stack;

  ai.control.reset();
  ai.control.enqueue({ kind: "success", content: JSON.stringify(omeletteRecipe()) });
  ai.control.setDefault(null);

  await page.goto("/");
  await submitPasteImport(page, `Recipe text for ${RECIPE}`);

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { level: 3, name: RECIPE })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

async function openOmelette(): Promise<void> {
  await page.goto("/");
  await page.getByRole("heading", { level: 3, name: RECIPE }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  await expect(page.getByRole("heading", { name: RECIPE })).toBeVisible();
}

/** The recipe page's ingredient row for a name, wherever the layout puts the list. */
function ingredientRow(name: string) {
  return page.locator(`[data-testid="ingredient-row"][data-ingredient-name="${name}"]`).first();
}

/** The administration list's row for an Ingredient Name. */
function adminRow(name: string) {
  return page.locator(`[data-testid="ingredients-row"][data-ingredient-name="${name}"]`);
}

test("an administrator's picture reaches the lines that point at the name", async () => {
  await resetIngredientPicturesScenario();
  await configureImageGeneration(stack.ai.url);
  await importOmelette();

  // Before any picture exists, lines are plain text.
  await openOmelette();
  await expect(ingredientRow("eggs")).toBeVisible();
  await expect(page.getByTestId("ingredient-illustration")).toHaveCount(0);

  // The administrator finds the recipe's "eggs" among every ingredient.
  await page.goto("/settings?tab=admin");
  await page.getByTestId("ingredients-manage").click();
  await page.getByTestId("ingredients-search").fill("egg");
  await expect(adminRow("eggs")).toContainText("Used in 1 recipe");
  await expect(adminRow("chives")).toHaveCount(0);
  await page.getByTestId("ingredients-search").fill("");
  await expect(adminRow("chives")).toBeVisible();
  await page.getByTestId("ingredients-search").fill("egg");
  await adminRow("eggs").getByRole("button", { name: "Edit" }).click();

  stack.ai.control.succeedImageWith(DRAWN_PICTURE_BASE64);
  await page.getByTestId("ingredients-generate").click();

  await expect
    .poll(() => readIngredient("eggs"), { timeout: 60_000 })
    .toMatchObject({ imageUrl: expect.stringMatching(/^\/ingredient-images\//) });
  expect(stack.ai.control.imageRequestCount).toBe(1);

  // The panel watches for the drawing and shows it without a reload.
  await expect(page.getByTestId("ingredients-picture-busy")).toHaveCount(0, { timeout: 30_000 });

  await page.getByTestId("ingredients-cancel").click();
  await expect(adminRow("eggs").getByTestId("ingredient-illustration")).toBeVisible();
  await expect(adminRow("eggs")).toContainText("Used in 1 recipe");

  const stored = await readIngredient("eggs");
  const pictureResponse = await page.request.get(stored!.imageUrl!);

  expect(pictureResponse.status()).toBe(200);
  expect(pictureResponse.headers()["content-type"]).toBe("image/webp");

  // A used ingredient cannot be deleted: the administrator is told why instead.
  await adminRow("eggs").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Ingredient in use")).toBeVisible();
  await expect(page.getByTestId("ingredients-confirm")).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(await readIngredient("eggs")).not.toBeNull();

  // The recipe page: the line carries the picture because it points at that
  // ingredient. "hen egg" is an ingredient of its own, and has none.
  await openOmelette();
  await expect(
    ingredientRow("eggs").first().getByTestId("ingredient-illustration")
  ).toHaveAttribute("src", stored!.imageUrl!);
  await expect(ingredientRow("hen egg").getByTestId("ingredient-illustration")).toHaveCount(0);
  await expect(ingredientRow("chives").getByTestId("ingredient-illustration")).toHaveCount(0);
});

test("a second recipe using the name lands on the same ingredient", async () => {
  // One row, one picture: the second recipe shows the drawing already made,
  // and nothing is drawn or billed again.
  const before = await readIngredient("eggs");

  stack.ai.control.reset();
  stack.ai.control.enqueue({
    kind: "success",
    content: JSON.stringify({
      ...omeletteRecipe(),
      name: SECOND_RECIPE,
      recipeIngredient: { metric: ["2 eggs"], us: ["2 eggs"] },
    }),
  });
  stack.ai.control.setDefault(null);

  await page.goto("/");
  await submitPasteImport(page, `Recipe text for ${SECOND_RECIPE}`);

  await expect
    .poll(async () => (await readIngredient("eggs"))?.recipeCount, { timeout: 60_000 })
    .toBe(2);
  expect((await readIngredient("eggs"))?.imageUrl).toBe(before!.imageUrl);
  expect(stack.ai.control.imageRequestCount).toBe(0);
});

test("a grocery typed by hand gets the picture its name matches", async () => {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill("6 Eggs");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Close panel" }).click();

  const row = page.locator('[data-grocery-name="Eggs"]').first();

  await expect(row).toBeVisible();
  await expect(row.getByTestId("ingredient-illustration")).toBeVisible();
});

test("the editor suggests pictured names and rewrites only the name", async () => {
  await openOmelette();

  const recipeUrl = page.url();

  await page.goto(recipeUrl.replace(/\/recipes\/([^/]+)$/, "/recipes/edit/$1"));

  const textareas = page.locator("textarea");

  await expect(textareas.first()).toBeVisible();

  // The chives line: its name has no picture.
  let chivesRow = -1;

  await expect(async () => {
    const values = await textareas.evaluateAll((areas) =>
      areas.map((area) => (area as HTMLTextAreaElement).value)
    );

    chivesRow = values.findIndex((value) => /chives$/.test(value));
    expect(chivesRow).toBeGreaterThanOrEqual(0);
  }).toPass({ timeout: 10_000 });

  const field = textareas.nth(chivesRow);
  const row = field.locator("xpath=ancestor::li[1]");

  await expect(row.getByTestId("ingredient-illustration")).toHaveCount(0);

  // A name with no picture is suggested just the same, on the empty row below.
  const emptyField = textareas.nth(chivesRow + 1);

  await emptyField.fill("1 tbsp chiv");
  await expect(page.getByTestId("name-suggestion").first()).toContainText("chives");
  await emptyField.fill("");

  // Typing the start of a known name offers it; picking keeps the amount.
  await field.fill("5 g eg");
  await expect(page.getByTestId("name-suggestion").first()).toContainText("eggs");
  await page.getByTestId("name-suggestion").first().click();

  await expect(field).toHaveValue("5 g eggs");
  await expect(row.getByTestId("ingredient-illustration")).toBeVisible();
});
