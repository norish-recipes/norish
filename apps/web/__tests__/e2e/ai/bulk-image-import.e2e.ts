import type { Page } from "@playwright/test";

import type { AIE2EStack, FakeAIProvider } from "./fixture";
import { expect, test } from "./fixture";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

function recipe(name: string) {
  return {
    name,
    description: "A deterministic recipe returned for the bulk image import.",
    notes: null,
    recipeYield: 2,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    recipeIngredient: {
      metric: ["150 g red lentils", "400 ml water"],
      us: ["5 oz red lentils", "1.5 cups water"],
    },
    recipeInstructions: {
      metric: ["Simmer the lentils until soft.", "Serve warm."],
      us: ["Simmer the lentils until soft.", "Serve warm."],
    },
    keywords: null,
    allergyIndications: [],
    categories: ["Dinner"],
    nutrition: { calories: null, fat: null, carbs: null, protein: null },
  };
}

const FIRST_RECIPE = recipe("Bulk Photographed Lentil Bake");
const SECOND_RECIPE = recipe("Bulk Photographed Bean Stew");

const FIRST_IMAGE = { name: "first-page.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG };
const SECOND_IMAGE = { name: "second-page.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG };

let stack: AIE2EStack;
let page: Page;

test.beforeEach(async ({ aiStack, page: fixturePage }) => {
  stack = aiStack;
  page = fixturePage;
  await setAutomaticEnrichment({});
});

async function openBulkImport(): Promise<void> {
  await page.goto("/");
  await page.getByTestId("bulk-image-import-button").click();
  await expect(page).toHaveURL(/\/recipes\/import$/);
}

function uploadInput() {
  return page.locator("input[type='file']");
}

async function submitBatch(images: { name: string; mimeType: string; buffer: Buffer }[]) {
  await uploadInput().setInputFiles(images);
  await page.getByRole("button", { name: /^Import \d+ recipes?$/ }).click();
}

function statusChip(label: string) {
  return page.getByText(label, { exact: true });
}

test("each image becomes its own recipe, and a failed one retries from the batch", async () => {
  const ai: FakeAIProvider = stack.ai;

  ai.control.enqueue({ kind: "success", content: JSON.stringify(FIRST_RECIPE) });
  ai.control.setDefault({ kind: "error", status: 400 });

  await openBulkImport();
  await submitBatch([FIRST_IMAGE, SECOND_IMAGE]);

  await expect(page.getByRole("heading", { name: "Import progress" })).toBeVisible();
  await expect(statusChip("Recipe created")).toBeVisible({ timeout: 60_000 });
  await expect(statusChip("Failed")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: "Open recipe" })).toHaveCount(1);

  ai.control.enqueue({ kind: "success", content: JSON.stringify(SECOND_RECIPE) });
  await page.getByRole("button", { name: "Retry", exact: true }).click();

  await expect(statusChip("Recipe created")).toHaveCount(2, { timeout: 60_000 });
  await expect(page.getByRole("link", { name: "Open recipe" })).toHaveCount(2);
  await expect(page.getByText("All images are imported.")).toBeVisible();

  const hrefs = await page
    .getByRole("link", { name: "Open recipe" })
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));

  expect(new Set(hrefs).size).toBe(2);

  for (const href of hrefs) {
    await page.goto(href!);
    await expect(
      page.getByRole("heading", { name: "Ingredients" }).filter({ visible: true }).first()
    ).toBeVisible();
  }

  await page.goto("/");

  await expect(async () => {
    await page.reload();
    const names = [FIRST_RECIPE.name, SECOND_RECIPE.name];

    for (const name of names) {
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 3_000 });
    }
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
});

test("an unsupported image never enters the batch or reaches the provider", async () => {
  const requestsBefore = stack.ai.control.requestCount;

  await openBulkImport();
  await uploadInput().setInputFiles([
    FIRST_IMAGE,
    { name: "shopping-list.txt", mimeType: "text/plain", buffer: Buffer.from("not a recipe") },
  ]);

  await expect(page.getByText("shopping-list.txt is not a JPG, PNG or WebP image.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import 1 recipe" })).toBeVisible();
  await expect(page.getByText("1 image selected")).toBeVisible();
  expect(stack.ai.control.requestCount).toBe(requestsBefore);
});
