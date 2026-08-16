/**
 * Recipe Archive round-trip through a real browser.
 *
 * The one browser-level acceptance the Recipe Archive needs: a signed-in user
 * exports from settings, receives the streamed `.norishrecipes` response of
 * the authenticated route, and feeds that very file back through the archive
 * import UI. It exercises route auth, streaming delivery, and real media on
 * disk in a single pass — the format's own edge cases (unknown cuisines,
 * newer majors, corrupt entries) stay at the unit seam beside the parser.
 *
 * The recipe's media is deleted from disk between export and reimport, so an
 * image that displays afterwards can only have travelled inside the archive.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import type { StoredRecipe } from "./recipe-archive-support";
import { expect, test } from "./fixture";
import { submitImageImport } from "./import-support";
import { applyMarks, clearMarks, readMarks, readStoredRecipes } from "./recipe-archive-support";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

const WEB_DIR = path.resolve(import.meta.dirname, "../../..");

/** A real image, unlike the import helper's single pixel: media has to reach disk here. */
const RECIPE_PHOTO = path.join(WEB_DIR, "public/favicon-96x96.png");

// A deterministic recipe the fake provider returns for the vision call. The
// distinctive name is how the round-trip finds its own recipe again.
const ARCHIVE_RECIPE = {
  name: "Portable Pumpkin Traybake",
  description: "A deterministic recipe returned for the Recipe Archive round-trip.",
  notes: null,
  recipeYield: 4,
  prepTime: null,
  cookTime: null,
  totalTime: null,
  recipeIngredient: {
    metric: ["600 g pumpkin", "2 tbsp olive oil"],
    us: ["1.3 lb pumpkin", "2 tbsp olive oil"],
  },
  recipeInstructions: {
    metric: ["Cube the pumpkin.", "Roast for 35 minutes."],
    us: ["Cube the pumpkin.", "Roast for 35 minutes."],
  },
  keywords: null,
  allergyIndications: [],
  categories: ["Dinner"],
  nutrition: { calories: null, fat: null, carbs: null, protein: null },
};

const EXPORTED_RATING = 4;

let stack: AIE2EStack;
let page: Page;

test.beforeEach(async ({ aiStack, page: fixturePage }) => {
  stack = aiStack;
  page = fixturePage;
  await setAutomaticEnrichment({});
});

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);

    return true;
  } catch {
    return false;
  }
}

/** Open the settings tab that holds both doorways: archive import and export. */
async function openArchiveSettings(): Promise<void> {
  await page.goto("/settings?tab=user");
  await expect(page.getByRole("button", { name: "Export Recipe Archive" })).toBeVisible({
    timeout: 30_000,
  });
}

test("a Recipe Archive exported from settings imports back over the recipe it came from", async () => {
  // The export zips and the import rehomes every recipe the instance holds by
  // this point in the project, on top of an AI import and a queued worker.
  test.slow();

  stack.ai.control.succeedWith(ARCHIVE_RECIPE);

  await page.goto("/");
  await submitImageImport(page, {
    name: "traybake.png",
    mimeType: "image/png",
    buffer: await fs.readFile(RECIPE_PHOTO),
  });

  // The queued import persists the recipe and saves the uploaded photo with it.
  let stored: StoredRecipe | undefined;

  await expect(async () => {
    const rows = await readStoredRecipes(ARCHIVE_RECIPE.name);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.images.length).toBeGreaterThan(0);
    stored = rows[0];
  }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 5_000] });

  const recipeId = stored!.id;
  const userId = stored!.userId!;

  await applyMarks(userId, recipeId, EXPORTED_RATING);

  // Export: the real streamed response of the authenticated route, delivered
  // to the browser as a download.
  await openArchiveSettings();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export Recipe Archive" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^norish-recipes-\d{4}-\d{2}-\d{2}\.norishrecipes$/);

  // The importer validates by extension, so the file keeps the name the
  // route gave it.
  const archivePath = test.info().outputPath(download.suggestedFilename());

  await download.saveAs(archivePath);

  // Take away everything the reimport could otherwise coast on: the media on
  // disk, and the marks the archive is supposed to carry.
  await fs.rm(path.join(stack.server.uploadsDir, "recipes", recipeId), {
    recursive: true,
    force: true,
  });
  await clearMarks(userId, recipeId);

  // Reimport through the normal archive import flow — no new skill needed.
  await openArchiveSettings();
  await page.setInputFiles("#archive-file-upload", archivePath);

  await expect(page.getByText(/^Complete: \d+ imported/)).toBeVisible({ timeout: 180_000 });

  // Matched and overwritten, never duplicated: one recipe, the same one.
  const reimported = await readStoredRecipes(ARCHIVE_RECIPE.name);

  expect(reimported).toHaveLength(1);
  expect(reimported[0]!.id).toBe(recipeId);

  // The media came back out of the archive and the app serves it again.
  const restoredMedia = reimported[0]!.images[0];

  expect(restoredMedia).toBeTruthy();
  expect(await fileExists(path.join(stack.server.uploadsDir, restoredMedia!))).toBe(true);

  const servedMedia = await page.request.get(restoredMedia!);

  expect(servedMedia.ok()).toBe(true);

  // The exporter's marks landed on the recipe that won the match.
  expect(await readMarks(userId, recipeId)).toEqual({
    rating: EXPORTED_RATING,
    favorite: true,
  });
});
