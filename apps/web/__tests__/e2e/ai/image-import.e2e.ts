/**
 * Image import through the real stack.
 *
 * A browser-triggered image import uploads real image bytes, a real queued
 * worker calls the vision extraction, and the extraction's provider call is
 * served by the fake AI provider's chat-completions route — vision requests
 * use the same path as text requests, with image parts in the message
 * content. Only the provider HTTP boundary is faked.
 *
 * This is the regression net for the AI-architecture refactor: the flow and
 * the wire shape asserted here must survive extraction moving packages and
 * the runtime taking over the provider call.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { expect, test } from "./fixture";
import { submitImageImport } from "./import-support";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

// A deterministic recipe the fake provider returns for the vision call. The
// distinctive name can only reach the browser through the controlled provider
// response, since the uploaded pixel carries no recipe content.
const IMAGE_RECIPE = {
  name: "Photographed Lentil Bake",
  description: "A deterministic recipe returned for the vision extraction call.",
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
    metric: ["Simmer the lentils until soft.", "Bake for 20 minutes."],
    us: ["Simmer the lentils until soft.", "Bake for 20 minutes."],
  },
  keywords: null,
  allergyIndications: [],
  categories: ["Dinner"],
  nutrition: { calories: null, fat: null, carbs: null, protein: null },
};

// Two A4 pages of a recipe, printed to PDF by Chromium.
const TWO_PAGE_PDF = path.join(import.meta.dirname, "fixtures/two-page-recipe.pdf");

let stack: AIE2EStack;
let page: Page;

test.beforeEach(async ({ aiStack, page: fixturePage }) => {
  stack = aiStack;
  page = fixturePage;
  await setAutomaticEnrichment(stack, {});
});

test("a browser image import reaches the provider as a vision request and persists the result", async () => {
  const ai = stack.ai;

  ai.control.succeedWith(IMAGE_RECIPE);

  await page.goto("/");
  await submitImageImport(page);

  // The real image-import worker persists the controlled recipe and the
  // dashboard renders it.
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(IMAGE_RECIPE.name).first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  expect(ai.control.requestCount).toBeGreaterThanOrEqual(1);

  const parts = lastVisionRequestParts();

  expect(parts.some((part) => part.type === "text")).toBe(true);
  expect(parts.some((part) => part.type === "image_url")).toBe(true);
});

test("a PDF import reaches the provider as one picture per page (#637)", async () => {
  const name = "Scanned Pancakes";

  stack.ai.control.succeedWith({ ...IMAGE_RECIPE, name });

  await page.goto("/");
  await submitImageImport(page, {
    name: "scanned-recipe.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(TWO_PAGE_PDF),
  });

  await expect(async () => {
    await page.reload();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  // The browser drew the pages, so any vision model reads them.
  expect(lastVisionRequestParts().filter((part) => part.type === "image_url")).toHaveLength(2);
});

/**
 * The content parts of the provider's last request, which went to the
 * chat-completions path with the uploads beside the prompt text: the wire
 * shape of a vision request.
 */
function lastVisionRequestParts(): { type: string }[] {
  const request = stack.ai.control.requests.at(-1)!;

  expect(request.path).toBe("/v1/chat/completions");

  const body = request.body as {
    messages: { role: string; content: unknown }[];
  };
  const userMessage = body.messages.find((message) => message.role === "user");

  expect(userMessage).toBeDefined();
  expect(Array.isArray(userMessage!.content)).toBe(true);

  return userMessage!.content as { type: string }[];
}
