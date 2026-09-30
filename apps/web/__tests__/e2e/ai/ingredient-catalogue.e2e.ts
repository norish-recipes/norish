/**
 * The ingredient catalogue, in a browser.
 *
 * What a household actually sees: a Dutch "ui" put in the Pantry leaves an
 * English recipe's "onion" off the list, because both are spellings of one
 * Ingredient; a food Norish was not sure about is marked on the Ingredients
 * page; and merging it into the food that holds an Aisle Link files its
 * grocery in that aisle. The scenario seeds a small catalogue of its own
 * rather than fetching Open Food Facts. The real Norish server, database,
 * Redis, tRPC and realtime are all in the path; nothing outbound is.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixture";
import {
  readIngredientOf,
  resetCatalogueScenario,
  seedCatalogue,
  seedStoreFiling,
  setParent,
} from "./ingredient-catalogue-support";
import { readGroceryNames, readPantryNames, seedRecipeWithIngredients } from "./pantry-support";

test.describe.configure({ mode: "serial" });

const RECIPE = "Onion soup";
/** A page of the catalogue is fifty; these fill one and start another. */
const FILLER_COUNT = 55;
const fillerName = (n: number) => `zz filler ${String(n).padStart(2, "0")}`;
const STORE = "Groenteboer";
const AISLE = "Groente";

let page: Page;
let recipeId: string;

test.beforeAll(async ({ browser, aiStack }) => {
  await resetCatalogueScenario();

  const ids = await seedCatalogue([
    {
      name: "onion",
      aliases: [
        { text: "onion", locale: "en" },
        { text: "onions", locale: "en" },
        { text: "ui", locale: "nl" },
      ],
    },
    { name: "uitjes", aliases: [{ text: "uitjes", locale: "nl" }], flagged: true },
    // Flagged too, for the round of Ask AI: settled there so "uitjes" stays for the merge below.
    {
      name: "knoflookteentjes",
      aliases: [{ text: "knoflookteentjes", locale: "nl" }],
      flagged: true,
    },
    { name: "red onion", aliases: [{ text: "red onion", locale: "en" }] },
    { name: "shallot", aliases: [{ text: "shallot", locale: "en" }] },
    // Enough foods, sorted last, for the list to have a second page to scroll to.
    ...Array.from({ length: FILLER_COUNT }, (_, index) => {
      const name = fillerName(index + 1);

      return { name, aliases: [{ text: name, locale: "en" }] };
    }),
  ]);

  await setParent(ids["red onion"]!, ids.onion!);

  await seedStoreFiling(STORE, AISLE, ids.onion!);
  recipeId = await seedRecipeWithIngredients(RECIPE, ["onion", "butter"]);

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
});

/** The Pantry panel, opened from the groceries page's menu. */
async function openPantry(): Promise<Locator> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "View Mode" }).click();
  await page.getByRole("menuitem", { name: "Pantry" }).click();

  const panel = page.getByRole("dialog", { name: "Pantry" });

  await expect(panel).toBeVisible();

  return panel;
}

/** The Ingredients page's row for an Ingredient, by its own name. */
function ingredientRow(name: string): Locator {
  return page.locator(`[data-testid="ingredient-row"][data-ingredient="${name}"]`);
}

/** The Store's block on the grocery list. */
function storeBlock(): Locator {
  return page
    .locator("[data-store-id]")
    .filter({ has: page.locator("[data-store-drop-target]").filter({ hasText: STORE }) })
    .last();
}

/** The rows the Store files under an aisle. */
async function rowsIn(aisleName: string): Promise<string[]> {
  return storeBlock()
    .locator("[data-aisle-id]")
    .filter({ has: page.getByTestId("aisle-heading").filter({ hasText: aisleName }) })
    .locator("[data-grocery-name]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-grocery-name") ?? ""));
}

test("a Dutch 'ui' in the Pantry leaves an English recipe's 'onion' off the list", async () => {
  const pantry = await openPantry();

  await pantry.getByTestId("pantry-name").fill("ui");
  await pantry.getByTestId("pantry-name").press("Enter");
  // "ui" is a spelling of onion: the Pantry holds the Ingredient, shown by its name.
  await expect(pantry.locator('[data-pantry-ingredient="onion"]')).toHaveText("onion");
  await expect.poll(readPantryNames).toEqual(["onion"]);

  await page.goto(`/recipes/${recipeId}`);
  await page.getByRole("button", { name: "Add", exact: true }).first().click();

  const panel = page.getByRole("dialog", { name: "Add to Groceries" });
  const held = panel.getByTestId("pantry-section");

  await expect(held.getByRole("checkbox", { name: "onion" })).not.toBeChecked();
  await expect(panel.getByRole("checkbox", { name: "butter" })).toBeChecked();
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel).toBeHidden();
  await expect.poll(readGroceryNames).toEqual(["butter"]);
});

test("the list asks for its next page as the end comes into view", async () => {
  await page.goto("/settings?tab=ingredients");
  await expect(ingredientRow("uitjes")).toBeVisible();
  // The last food is on the second page: not there until the end is reached.
  await expect(ingredientRow(fillerName(FILLER_COUNT))).toHaveCount(0);

  // The list is virtualised, so the end is scrolled to as many times as pages land.
  await expect
    .poll(
      async () => {
        await page.getByTestId("ingredients-list-end").scrollIntoViewIfNeeded();

        return ingredientRow(fillerName(FILLER_COUNT)).count();
      },
      { timeout: 15_000 }
    )
    .toBe(1);
  await page.evaluate(() => window.scrollTo(0, 0));
});

test("a food's name, parent and translations land together with Save", async () => {
  const before = fillerName(1);
  const after = "zz filler one";

  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("ingredients-search").fill(before);
  await ingredientRow(before).getByTestId("ingredient-toggle").click();
  const opened = ingredientPanel(before);

  await expect(opened.getByTestId("ingredient-save")).toBeDisabled();
  await opened.getByTestId("ingredient-name-input").fill(after);
  // Translations are a click through, in a panel of their own.
  await opened.getByTestId("ingredient-all-spellings").click();
  const spellings = page.getByRole("dialog", { name: "Translations" });

  await spellings.getByTestId("ingredient-alias-input").fill("vulling");
  await spellings.getByTestId("ingredient-alias-input").press("Enter");
  await spellings.getByRole("button", { name: "Done" }).click();
  // A parent is picked in a panel of its own and joins the draft.
  await opened.getByTestId("ingredient-set-parent").click();
  const asking = page.getByRole("dialog", { name: "Set parent…" });

  await asking.getByTestId("ingredient-picker").fill("onion");
  await page.getByRole("option", { name: "onion", exact: true }).click();
  await asking.getByTestId("ingredient-relocation-confirm").click();
  await expect(opened.getByTestId("ingredient-parent")).toContainText("onion");
  // Nothing has landed yet.
  await expect.poll(() => readIngredientOf("vulling")).toBeNull();

  await opened.getByTestId("ingredient-save").click();
  await expect(opened.getByTestId("ingredient-save")).toBeDisabled();
  await page.getByTestId("ingredients-search").fill(after);
  await expect(ingredientRow(after)).toBeVisible();
  await expect(ingredientRow(after)).toContainText("3 translations, parent: onion");
  await expect.poll(() => readIngredientOf("vulling")).not.toBeNull();

  await opened.getByRole("button", { name: "Close panel" }).click();
  await expect(opened).toBeHidden();

  // With nothing typed, the list is the tree of kinds: the food is no longer
  // a root, and folds out under onion.
  await page.getByTestId("ingredients-search").fill("");
  await expect(ingredientRow("onion")).toBeVisible();
  await expect(ingredientRow(after)).toHaveCount(0);
  await ingredientRow("onion").getByTestId("ingredient-kinds-toggle").click();
  await expect(ingredientRow(after)).toBeVisible();
  await expect(ingredientRow(after)).toHaveAttribute("data-depth", "1");
  await expect(ingredientRow("red onion")).toHaveAttribute("data-depth", "1");
  await ingredientRow("onion").getByTestId("ingredient-kinds-toggle").click();
  await expect(ingredientRow(after)).toHaveCount(0);
});

test("a food Norish was not sure about is marked on the Ingredients page", async () => {
  await page.goto("/settings?tab=ingredients");
  // The filters sit in a panel and land with Apply, as the dashboard's do.
  await page.getByTestId("ingredients-filters").click();
  const filters = page.getByRole("dialog", { name: "Filters" });

  const flaggedOnly = filters.getByRole("switch", { name: "Only flagged" });

  await flaggedOnly.press("Space");
  await expect(flaggedOnly).toBeChecked();
  await filters.getByTestId("ingredients-filters-apply").click();
  await expect(filters).toBeHidden();

  await expect(ingredientRow("uitjes").getByTestId("ingredient-flagged")).toBeVisible();
  await expect(ingredientRow("uitjes").getByTestId("ingredient-flag-reason")).toBeVisible();
  await expect(ingredientRow("onion")).toHaveCount(0);

  // The page offers to ask AI about every flagged food at once; a food's own
  // panel says why it is flagged and offers to ask about it alone.
  await expect(page.getByTestId("ingredients-ask-ai-all")).toBeVisible();
  await ingredientRow("uitjes").getByTestId("ingredient-toggle").click();
  const opened = ingredientPanel("uitjes");

  await expect(opened.getByTestId("ingredient-flag-notice")).toBeVisible();
  await expect(opened.getByTestId("ingredient-ask-ai")).toBeVisible();
  await opened.getByRole("button", { name: "Close panel" }).click();
  await expect(opened).toBeHidden();
});

test("the filters can show only the foods with neither parent nor kinds", async () => {
  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("ingredients-filters").click();
  const filters = page.getByRole("dialog", { name: "Filters" });
  const standalone = filters.getByRole("switch", { name: "Without parent or kinds" });

  await standalone.press("Space");
  await expect(standalone).toBeChecked();
  await filters.getByTestId("ingredients-filters-apply").click();
  await expect(filters).toBeHidden();

  // onion has kinds and red onion a parent: neither is listed; shallot is.
  await expect(ingredientRow("shallot")).toBeVisible();
  await expect(ingredientRow("onion")).toHaveCount(0);
  await expect(ingredientRow("red onion")).toHaveCount(0);
  // The header offers to find their parents with AI, and a food's panel to find its own.
  await expect(page.getByTestId("ingredients-find-parents-all")).toBeVisible();
  await ingredientRow("shallot").getByTestId("ingredient-toggle").click();
  await expect(ingredientPanel("shallot").getByTestId("ingredient-find-parent")).toBeVisible();
  await ingredientPanel("shallot").getByRole("button", { name: "Close panel" }).click();
});

test("asking AI about the flagged foods on screen runs as one round of suggestions to confirm", async ({
  ai,
}) => {
  // The round asks the language model to read the name, then to compare it
  // with what that reading finds: nothing here, so the food is its own.
  ai.control.enqueue(
    {
      kind: "success",
      content: JSON.stringify({ englishName: "garlic cloves", generalFood: "garlic", sure: true }),
    },
    {
      kind: "success",
      content: JSON.stringify({
        verdict: "new",
        food: null,
        sure: true,
        englishName: "garlic cloves",
      }),
    }
  );
  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("ingredients-search").fill("knoflook");
  await expect(ingredientRow("knoflookteentjes").getByTestId("ingredient-flagged")).toBeVisible();
  await expect(ingredientRow("uitjes")).toHaveCount(0);

  // One round over the flagged foods on screen; the page follows it over the socket.
  await page.getByTestId("ingredients-ask-ai-all").click();
  // The row itself shows its turn in the round.
  await expect(ingredientRow("knoflookteentjes").getByTestId("ingredient-reviewing")).toBeVisible();
  // The round ends with the suggestions drawer open: AI changed nothing on its own.
  const panel = page.getByRole("dialog", { name: "AI suggestions" });

  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("ingredient-reviewing")).toHaveCount(0);
  const suggestion = panel.getByTestId("ingredient-suggestion");

  await expect(suggestion).toHaveCount(1);
  await expect(suggestion).toHaveAttribute("data-kind", "distinct");
  await expect(suggestion).toContainText("Keep knoflookteentjes as a food of its own");
  await expect(suggestion).toContainText("AI read it as “garlic cloves”.");
  await suggestion.getByTestId("ingredient-suggestion-confirm").click();
  await expect(suggestion).toHaveCount(0);
  await expect(panel.getByText("Nothing is waiting on you.")).toBeVisible();
  await panel.getByRole("button", { name: "Close panel" }).click();
  await expect(panel).toBeHidden();
  await expect(ingredientRow("knoflookteentjes").getByTestId("ingredient-flagged")).toHaveCount(0);
  await expect(page.getByTestId("ingredients-ask-ai-all")).toHaveCount(0);
});

/** The panel a row opens: a dialog named after the food. */
function ingredientPanel(name: string) {
  return page.getByRole("dialog", { name, exact: true });
}

/** Add a grocery under the Store, through the panel a shopper uses. */
async function addGrocery(name: string): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(storeBlock().locator(`[data-grocery-name="${name}"]`)).toBeVisible();
}

test("a kind of a food with no aisle of its own is filed in its parent's", async () => {
  await addGrocery("red onion");

  await expect.poll(() => rowsIn(AISLE)).toEqual(["red onion"]);
});

test("merging it into the food that holds an Aisle Link files its grocery in that aisle", async () => {
  await addGrocery("uitjes");
  await expect.poll(() => rowsIn(AISLE)).toEqual(["red onion"]);

  await page.goto("/settings?tab=ingredients");
  await ingredientRow("uitjes").getByTestId("ingredient-toggle").click();
  await ingredientPanel("uitjes").getByTestId("ingredient-merge").click();
  // Picking what to merge into is a panel over the food's own.
  const asking = page.getByRole("dialog", { name: "Merge into…" });

  await asking.getByTestId("ingredient-picker").fill("onion");
  await page.getByRole("option", { name: "onion", exact: true }).click();
  await asking.getByTestId("ingredient-relocation-confirm").click();
  // Merged away, the food's panel closes with its row.
  await expect(ingredientPanel("uitjes")).toBeHidden();
  await expect(ingredientRow("uitjes")).toHaveCount(0);
  await expect.poll(() => readIngredientOf("uitjes")).toBe("onion");

  await page.goto("/groceries");
  await expect.poll(async () => (await rowsIn(AISLE)).sort()).toEqual(["red onion", "uitjes"]);
});

test("a food nothing uses can be deleted, and one a grocery uses cannot", async () => {
  await page.goto("/settings?tab=ingredients");

  await ingredientRow("shallot").getByTestId("ingredient-toggle").click();
  await ingredientPanel("shallot").getByTestId("ingredient-delete").click();
  await page.getByTestId("ingredient-delete-confirm").click();
  await expect(ingredientPanel("shallot")).toBeHidden();
  await expect(ingredientRow("shallot")).toHaveCount(0);
  await expect.poll(() => readIngredientOf("shallot")).toBeNull();

  // "red onion" is on the grocery list: it stays, and the page says why.
  await ingredientRow("onion").getByTestId("ingredient-kinds-toggle").click();
  await ingredientRow("red onion").getByTestId("ingredient-toggle").click();
  await ingredientPanel("red onion").getByTestId("ingredient-delete").click();
  await page.getByTestId("ingredient-delete-confirm").click();
  await expect(
    page.getByText("Recipes, groceries or the pantry still use this ingredient")
  ).toBeVisible();
  await expect(ingredientRow("red onion")).toHaveCount(1);
});
