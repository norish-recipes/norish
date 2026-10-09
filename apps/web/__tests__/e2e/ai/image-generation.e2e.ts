/**
 * Image Generation through a real browser, a real server, and the fake AI
 * provider's two routes: the brief request on chat completions, the drawing
 * on the image route.
 *
 * What is asserted is what a reader sees and what is stored: the primary
 * image is replaced, the page re-tints from the new Dish Colour, the
 * previous image is gone from the gallery — and the bulk sweep names its
 * image count, fills gaps only by default, and reaches every recipe with
 * overwrite on.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { Client } from "pg";

import type { AIE2EStack } from "./fixture";
import { databaseUrl } from "./database";
import { expect, test } from "./fixture";
import {
  configureImageGeneration,
  readStoredDishColor,
  readStoredGalleryImages,
  seedRecipePhoto,
} from "./image-generation-support";
import { submitPasteImport } from "./import-support";
import { requestEnrichment, setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");
const GENERATED_DISH_BASE64 = readFileSync(path.join(FIXTURES_DIR, "generated-dish.jpg")).toString(
  "base64"
);
const SUPPLIED_PHOTO_PATH = path.join(FIXTURES_DIR, "supplied-photo.jpg");

/** The seeded photograph's Dish Colour: a red whose OKLCH hue sits near 32. */
const SUPPLIED_PHOTO_DISH_COLOR = "#b03c28";
/** The fixture drawing is a solid green; its extracted hue lands near 148. */
const GENERATED_HUE_PATTERN = /--dish-h:\s*1[2-7]\d(?:\.\d+)?/;

const VISUAL_BRIEF = { brief: "A rust-red stew in a wide earthenware bowl." };

/** Extraction output with no image reference: a recipe born pictureless. */
function bareRecipe(name: string) {
  return {
    name,
    description: null,
    notes: null,
    recipeYield: 4,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    recipeIngredient: {
      metric: ["200 g pinto beans", "1 L vegetable stock"],
      us: ["7 oz pinto beans", "4 cups vegetable stock"],
    },
    recipeInstructions: {
      metric: ["Simmer for 40 minutes.", "Season, then serve."],
      us: ["Simmer for 40 minutes.", "Season, then serve."],
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

test.afterEach(async () => {
  await setAutomaticEnrichment({});
  await configureImageGeneration(null);
});

async function deleteAllRecipes(): Promise<void> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();
  try {
    await database.query("delete from recipes");
  } finally {
    await database.end();
  }
}

async function importRecipe(name: string): Promise<void> {
  const { ai } = stack;

  ai.control.reset();
  ai.control.enqueue({ kind: "success", content: JSON.stringify(bareRecipe(name)) });
  ai.control.setDefault(null);

  await page.goto("/");
  await submitPasteImport(page, `Recipe text for ${name}`);

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

async function openRecipe(name: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("heading", { level: 3, name }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** Direct the fake provider to serve one whole generation: brief, then image. */
function directGeneration(): void {
  const { ai } = stack;

  ai.control.succeedWith(VISUAL_BRIEF);
  ai.control.succeedImageWith(GENERATED_DISH_BASE64);
}

test("the manual action replaces the primary image and the page re-tints", async () => {
  const name = "Manually Pictured Stew";

  await deleteAllRecipes();
  await setAutomaticEnrichment({});
  await configureImageGeneration(stack.ai.url);
  await importRecipe(name);

  const { url: photoUrl } = await seedRecipePhoto({
    recipeName: name,
    uploadsDir: stack.server.uploadsDir,
    photoPath: SUPPLIED_PHOTO_PATH,
    dishColor: SUPPLIED_PHOTO_DISH_COLOR,
  });

  // The library reads the gallery, not the deprecated legacy scalar: the
  // seeded photograph exists only as a gallery row, and the card shows it.
  await page.goto("/");
  await expect(page.locator(`img[alt="${name}"]`).first()).toHaveAttribute(
    "src",
    new RegExp(photoUrl.replaceAll("/", "\\/"))
  );

  await openRecipe(name);

  // The reader's starting point: the supplied photograph leads the page and
  // tints it red.
  const heroImage = page.locator('img[alt="Recipe image"], img[alt^="Recipe media"]').first();

  await expect(heroImage).toHaveAttribute("src", new RegExp(photoUrl.replaceAll("/", "\\/")));
  await expect(page.locator("[data-dish-tint]")).toHaveAttribute(
    "style",
    /--dish-h:\s*(2\d|3\d|4[0-5])(?:\.\d+)?/
  );

  directGeneration();
  await requestEnrichment(page, "Generate Picture");
  await page.keyboard.press("Escape");

  // The stored outcome: exactly one gallery row, marked, and it is not the
  // photograph. The photograph's row is gone.
  await expect
    .poll(async () => readStoredGalleryImages(name), {
      timeout: 60_000,
      intervals: [1_000, 2_000, 5_000],
    })
    .toEqual([{ image: expect.not.stringContaining("supplied-photo"), generated: true }]);

  const [generated] = await readStoredGalleryImages(name);

  // The reader's outcome, without a reload: the canonical recipe update
  // swaps the hero and re-tints the page from the drawing's green.
  await expect(heroImage).toHaveAttribute(
    "src",
    new RegExp(generated!.image.replaceAll("/", "\\/")),
    { timeout: 30_000 }
  );
  await expect(page.locator("[data-dish-tint]")).toHaveAttribute("style", GENERATED_HUE_PATTERN, {
    timeout: 30_000,
  });

  // The previous image is gone from the gallery: after a fresh load, the
  // drawing is what renders and no element anywhere shows the photograph.
  await page.reload();
  await expect(heroImage).toHaveAttribute(
    "src",
    new RegExp(generated!.image.replaceAll("/", "\\/"))
  );
  await expect(page.locator(`img[src*="supplied-photo"]`)).toHaveCount(0);

  expect(await readStoredDishColor(name)).not.toBe(SUPPLIED_PHOTO_DISH_COLOR);
  expect(stack.ai.control.imageRequestCount).toBe(1);

  // The library follows too: the dashboard card reads the legacy thumbnail
  // scalar, which the replacement keeps in sync — and the drawing is a file
  // that actually serves, while the replaced photograph is gone rather than
  // lingering as a cached 404.
  await page.goto("/");

  const card = page.locator(`img[alt="${name}"]`).first();

  await expect(card).toHaveAttribute("src", new RegExp(generated!.image.replaceAll("/", "\\/")));

  const drawnResponse = await page.request.get(generated!.image);

  expect(drawnResponse.status()).toBe(200);

  const replacedResponse = await page.request.get(photoUrl);

  expect(replacedResponse.ok()).toBe(false);
});

test.describe("the bulk sweep", () => {
  const GAP_RECIPE = "Bulk Drawn Stew";
  const PHOTO_RECIPE = "Bulk Photographed Stew";

  async function openBulkPanel() {
    await page.goto("/settings?tab=admin");
    const trigger = page.getByRole("button", { name: /^Bulk enrichment/ }).first();

    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const panelId = await trigger.getAttribute("aria-controls");

    return page.locator(`[id="${panelId}"]`);
  }

  test.beforeEach(async () => {
    await deleteAllRecipes();
    await setAutomaticEnrichment({});
    await importRecipe(GAP_RECIPE);
    await importRecipe(PHOTO_RECIPE);
    await seedRecipePhoto({
      recipeName: PHOTO_RECIPE,
      uploadsDir: stack.server.uploadsDir,
      photoPath: SUPPLIED_PHOTO_PATH,
      dishColor: SUPPLIED_PHOTO_DISH_COLOR,
    });
    await configureImageGeneration(stack.ai.url);
    await setAutomaticEnrichment({ imageGeneration: true });
    stack.ai.control.reset();
    directGeneration();
  });

  test("fills gaps only by default, and says it will generate one image", async () => {
    const panel = await openBulkPanel();

    await panel.getByRole("button", { name: "Enrich all recipes" }).click();

    // The confirmation names the number before anything runs: one recipe
    // holds no image at all, so one image.
    await expect(page.getByText("The sweep will generate 1 image.")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Run on all recipes" }).click();

    await expect
      .poll(async () => readStoredGalleryImages(GAP_RECIPE), {
        timeout: 60_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toEqual([{ image: expect.stringContaining("/recipes/"), generated: true }]);

    // The photographed recipe was never touched: same single supplied row.
    expect(await readStoredGalleryImages(PHOTO_RECIPE)).toEqual([
      { image: expect.stringContaining("supplied-photo"), generated: false },
    ]);
    expect(stack.ai.control.imageRequestCount).toBe(1);
  });

  test("reaches every recipe with overwrite on, and says it will generate two", async () => {
    const panel = await openBulkPanel();

    await panel.getByRole("button", { name: "Enrich all recipes" }).click();

    await expect(page.getByText("The sweep will generate 1 image.")).toBeVisible({
      timeout: 15_000,
    });

    // Keyboard, because the switch's visual control covers the input.
    await page.getByRole("switch", { name: "Overwrite existing data" }).press("Space");

    // The number follows the toggle: with overwrite on, every eligible
    // recipe is drawn for, the photographed one included.
    await expect(page.getByText("The sweep will generate 2 images.")).toBeVisible();
    await expect(page.getByText("This cannot be undone.", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Overwrite all recipes" }).click();

    await expect
      .poll(async () => readStoredGalleryImages(PHOTO_RECIPE), {
        timeout: 60_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toEqual([{ image: expect.not.stringContaining("supplied-photo"), generated: true }]);

    await expect
      .poll(async () => readStoredGalleryImages(GAP_RECIPE), {
        timeout: 60_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toEqual([{ image: expect.stringContaining("/recipes/"), generated: true }]);

    expect(stack.ai.control.imageRequestCount).toBe(2);
  });
});
