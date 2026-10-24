/**
 * Clean up catalogue from the admin section: with Clean up new ingredients off, a recipe's food is
 * minted and nobody asks AI about it; a run over recipe foods asks, merges it into the food AI
 * names, and Changed by AI lists the merge. The real server, queues and workers are in the path;
 * the language model is the harness's.
 */
import type { Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { createRecipe } from "../harness/recipes";
import { expect, test } from "./fixture";
import {
  openCataloguePanel,
  readIngredientOf,
  resetCatalogueScenario,
  seedCatalogue,
  waitForAIPasses,
} from "./ingredient-catalogue-support";
import { updateAIConfig } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

let stack: AIE2EStack;
let page: Page;

test.beforeAll(async ({ aiStack }) => {
  stack = aiStack;
  await resetCatalogueScenario();
  await updateAIConfig(aiStack, {
    enabled: true,
    automaticIngredients: { cleanUp: false, nutrition: false, conversions: false, icon: false },
  });
  await seedCatalogue([
    {
      name: "garlic",
      aliases: [
        { text: "garlic", locale: "en" },
        { text: "knoflook", locale: "nl" },
      ],
    },
  ]);
});

test.beforeEach(({ page: fixturePage }) => {
  page = fixturePage;
});

test("a recipe-foods clean-up merges a food nobody asked about, listed under Changed by AI", async ({
  ai,
}) => {
  await createRecipe(stack.baseURL, stack.ownerCookies, "Knoflookbrood", ["knoflookteentjes"]);
  await expect
    .poll(() => readIngredientOf("knoflookteentjes"), { timeout: 30_000 })
    .toBe("knoflookteentjes");
  await waitForAIPasses(stack);
  // Clean up new ingredients is off: the mint asked nothing.
  expect(ai.control.ingredientRequests).toHaveLength(0);

  ai.control.enqueueIngredients({
    kind: "success",
    content: JSON.stringify({
      sure: true,
      action: { kind: "food", joined: null, reason: null },
      foods: [
        {
          written: "knoflookteentjes",
          englishName: "garlic",
          parents: null,
          nativeParents: null,
          category: null,
          otherNames: null,
        },
      ],
    }),
  });

  const panel = await openCataloguePanel(page);

  await panel.getByTestId("clean-up-catalogue").click();
  const dialog = page.getByTestId("clean-up-catalogue-dialog");

  await expect(dialog.getByTestId("clean-up-count")).toHaveText("AI will ask about 1 ingredient.");
  await dialog.getByTestId("clean-up-catalogue-start").click();
  await expect(dialog).toBeHidden();

  await expect.poll(() => readIngredientOf("knoflookteentjes"), { timeout: 30_000 }).toBe("garlic");
  await waitForAIPasses(stack);
  expect(ai.control.ingredientRequests).toHaveLength(1);

  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("ingredients-ai-changes-open").click();
  const changes = page.getByRole("dialog", { name: "Changed by AI" });

  await expect(
    changes
      .getByTestId("ingredient-ai-change")
      .filter({ hasText: "Merged knoflookteentjes into it" })
  ).toContainText("garlic");
});
