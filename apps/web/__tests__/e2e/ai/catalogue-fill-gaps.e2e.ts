/**
 * Fill gaps from the admin section: a seeded food no dataset has numbers for is counted under
 * Nutrition, a run asks AI for its macros, and the food's nutrition then reads "Estimated by AI".
 * The real server, queues and workers are in the path; the language model is the harness's.
 */
import type { Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { queryTrpc } from "../harness/trpc";
import { expect, test } from "./fixture";
import {
  openCataloguePanel,
  resetCatalogueScenario,
  seedCatalogue,
} from "./ingredient-catalogue-support";
import { updateAIConfig } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

let stack: AIE2EStack;
let page: Page;
let garlicId: string;

test.beforeAll(async ({ aiStack }) => {
  stack = aiStack;
  await resetCatalogueScenario();
  await updateAIConfig(aiStack, {
    enabled: true,
    automaticIngredients: { cleanUp: false, nutrition: false, conversions: false, icon: false },
  });
  const ids = await seedCatalogue([
    { name: "garlic", aliases: [{ text: "garlic", locale: "en" }] },
  ]);

  garlicId = ids.garlic!;
});

test.beforeEach(({ page: fixturePage }) => {
  page = fixturePage;
});

/** Where the food's numbers per 100 g come from, as the server reads them. */
async function numbersSource(): Promise<string | null> {
  const facts = await queryTrpc<{ numbers: { source: { kind: string } } | null } | null>(
    stack.baseURL,
    stack.ownerCookies,
    "ingredients.nutrition",
    { ingredientId: garlicId }
  );

  return facts?.numbers?.source.kind ?? null;
}

test("Fill gaps for nutrition gives a food without dataset numbers AI's estimate", async ({
  ai,
}) => {
  expect(await numbersSource()).toBeNull();
  ai.control.enqueueIngredients({
    kind: "success",
    content: JSON.stringify({ per100g: { kcal: 149, fat: 0.5, carbs: 33, protein: 6.4 } }),
  });

  const panel = await openCataloguePanel(page);

  await panel.getByTestId("fill-gaps").click();
  const dialog = page.getByTestId("fill-gaps-dialog");
  const nutrition = dialog.getByTestId("fill-gaps-nutrition");

  await expect(nutrition).toContainText("1 ingredient");
  await nutrition.getByText("Nutrition", { exact: true }).click();
  await dialog.getByTestId("fill-gaps-start").click();
  await expect(dialog).toBeHidden();

  await expect.poll(numbersSource, { timeout: 30_000 }).toBe("ai");
  expect(ai.control.ingredientRequests).toHaveLength(1);

  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("ingredients-search").fill("garlic");
  await page
    .locator('[data-testid="ingredient-row"][data-ingredient="garlic"]')
    .getByTestId("ingredient-toggle")
    .click();
  await page
    .getByRole("dialog", { name: "garlic", exact: true })
    .getByTestId("ingredient-nutrition-open")
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Nutrition", exact: true })
      .getByTestId("ingredient-nutrition-source")
  ).toHaveText("Estimated by AI");
});
