/**
 * Ingredient Nutrition, in a browser, on an instance without AI (ADR-0039).
 *
 * What a household sees: a recipe that supplies no nutrition shows a total
 * per serving worked out from its lines, says it is estimated where the
 * lines that borrowed from a parent food bring a tenth of it, and names
 * every line it left out behind an asterisk, each with why, a line whose fix
 * is a fact in its food's panel opening that panel. A household's correction changes its own
 * total and no other household's. A legacy "salt to taste" line, minted as
 * a food of its own before the resolver read it as salt, lands on salt at
 * the next boot under the new rules. The real Norish server applies the
 * committed source table at boot; the spec seeds the few Ingredients it
 * reads as the taxonomy seed would have.
 */
import type { BrowserContext, Page } from "@playwright/test";

import type { NutritionScenario } from "./ingredient-nutrition-support";
import { signIn } from "../harness/auth";
import { expect, test, USER_A, USER_B } from "./fixture";
import {
  forgetRungVersion,
  lineIngredient,
  removeNutritionScenario,
  seedNutritionScenario,
} from "./ingredient-nutrition-support";

test.describe.configure({ mode: "serial" });

/*
 * The total, per serving of two: 200 g onion (39 kcal per 100 g) is 78,
 * 300 g rice (350) is 1,050, three red onions (their own numbers, matched by
 * name to "Red onion, raw" at 35) weigh what an onion does, borrowed, 150 g
 * each, so 157.5, and 250 ml milk (whole, by Norish's fix, 63.9 at 1.03 g/ml)
 * is 164.5. The borrowing red onions bring more than a tenth: estimated.
 * A cup of flour has no spoon weight, olive oil for frying no amount, and
 * salt to taste is seasoning: all three are left out. 1,450 over two
 * servings is 725.
 */
const TOTAL = "725";
/** The same with the household's rice at 360 kcal per 100 g: 1,480 over two. */
const CORRECTED_TOTAL = "740";

let scenario: NutritionScenario | null = null;
let contexts: BrowserContext[] = [];
let pageA: Page;
let pageB: Page;

test.beforeAll(async ({ browser, offlineHarness }) => {
  scenario = await seedNutritionScenario(offlineHarness.databaseUrl);

  const open = async (user: typeof USER_A) => {
    const context = await browser.newContext({
      baseURL: offlineHarness.baseURL,
      reducedMotion: "reduce",
    });

    await context.addCookies(await signIn(offlineHarness.baseURL, user));
    contexts.push(context);

    return await context.newPage();
  };

  pageA = await open(USER_A);
  pageB = await open(USER_B);
});

test.afterAll(async ({ offlineHarness }) => {
  await Promise.all(contexts.map((context) => context.close()));
  contexts = [];
  await removeNutritionScenario(offlineHarness.databaseUrl, scenario);
});

/** The card in the layout on screen: the page renders both the phone's and the desktop's. */
function recipeCard(page: Page) {
  return page.getByTestId("nutrition-card").filter({ visible: true });
}

test("a recipe without nutrition shows one worked out from its lines, estimated and with what it left out", async () => {
  await pageA.goto(`/recipes/${scenario!.recipeId}`);

  const card = recipeCard(pageA);

  await expect(card).toContainText(TOTAL);
  await expect(card.getByTestId("nutrition-estimated")).toBeVisible();
  await expect(card.getByTestId("nutrition-calories-mark")).toBeVisible();
  await expect(card.getByTestId("nutrition-credit")).toContainText("CIQUAL 2025");
  await expect(card.getByTestId("nutrition-credit")).toContainText("Open Food Facts");

  // Behind the asterisk, every line left out, each with why.
  await expect(card.getByTestId("nutrition-left-out-toggle")).toHaveText(/3 lines not counted/);
  await card.getByTestId("nutrition-left-out-toggle").click();
  await expect(card.getByTestId("nutrition-left-out-line")).toHaveText([
    /flour\s*no spoon weight yet/,
    /olive oil for frying\s*no amount/,
    /salt to taste\s*seasoning/,
  ]);

  // Only the flour's fix is a fact its panel holds, so only the flour opens it, here.
  await expect(card.getByTestId("nutrition-left-out").getByRole("button")).toHaveCount(1);
  await card.getByRole("button", { name: "flour", exact: true }).click();

  const panel = pageA.getByRole("dialog", { name: "flour", exact: true });

  await panel.getByTestId("ingredient-nutrition-open").click();

  const nutrition = pageA.getByRole("dialog", { name: "Nutrition", exact: true });

  await expect(nutrition.getByTestId("ingredient-nutrition-source")).toContainText(
    "Wheat flour, type 110 · CIQUAL 2025"
  );
});

test("a household's correction changes its own total and no other household's", async () => {
  await pageA.goto(`/settings?tab=ingredients&ingredient=${scenario!.ingredientIds.rice}`);

  const panel = pageA.getByRole("dialog", { name: "rice", exact: true });

  await expect(panel.getByTestId("ingredient-nutrition-summary")).toContainText("kcal per 100 g");
  await panel.getByTestId("ingredient-nutrition-open").click();

  const nutrition = pageA.getByRole("dialog", { name: "Nutrition", exact: true });

  await expect(nutrition.getByTestId("ingredient-nutrition-source")).toContainText(
    "Rice, white, raw · CIQUAL 2025"
  );
  await nutrition.getByTestId("ingredient-nutrition-correct").click();

  const correction = pageA.getByTestId("nutrition-correction");

  await correction.getByTestId("nutrition-correction-numbers-label").click();
  await correction.getByTestId("nutrition-correction-calories").fill("360");
  await correction.getByTestId("nutrition-correction-fat").fill("1");
  await correction.getByTestId("nutrition-correction-carbs").fill("79");
  await correction.getByTestId("nutrition-correction-protein").fill("7");
  await pageA.getByTestId("nutrition-correction-save").click();

  await expect(nutrition.getByTestId("ingredient-nutrition-source")).toContainText(
    "Your household's own numbers"
  );

  await pageA.goto(`/recipes/${scenario!.recipeId}`);
  await expect(recipeCard(pageA)).toContainText(CORRECTED_TOTAL);

  await pageB.goto(`/recipes/${scenario!.recipeId}`);
  await expect(recipeCard(pageB)).toContainText(TOTAL);
  await expect(recipeCard(pageB)).not.toContainText(CORRECTED_TOTAL);
});

test("a legacy salt to taste line lands on salt once the resolver's rules change", async ({
  offlineHarness,
}) => {
  expect(
    await lineIngredient(offlineHarness.databaseUrl, scenario!.recipeId, "salt to taste")
  ).toBe(scenario!.legacyId);

  // An upgrade that brings new rules is a boot under a newer rung version.
  await forgetRungVersion(offlineHarness.databaseUrl);
  await offlineHarness.transition("stopped");
  await offlineHarness.transition("live");

  // The Ingredients page finds the spelling on salt, and no flagged food of its own.
  await pageA.goto("/settings?tab=ingredients");
  await pageA.getByTestId("ingredients-search").fill("salt to taste");

  const rows = pageA.getByTestId("ingredient-row");

  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute("data-ingredient", "salt");
  await expect(rows.first()).toHaveAttribute("data-flagged", "false");

  expect(
    await lineIngredient(offlineHarness.databaseUrl, scenario!.recipeId, "salt to taste")
  ).toBe(scenario!.ingredientIds.salt);
});
