/**
 * A household names its own Category in the recipe form and filters by it,
 * while another household is never offered it, even when it may view every
 * recipe; a recipe it can see still shows its own Categories (ADR-0040).
 */
import type { Browser, BrowserContext, Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { userIdOf } from "../harness/accounts";
import { signedInContext, signIn } from "../harness/auth";
import { seedRecipe, waitForRecipe } from "../harness/recipes";
import { callTrpc } from "../harness/trpc";
import { expect, MEMBER, OWNER, test } from "./fixture";

async function openPage(
  browser: Browser,
  stack: AIE2EStack,
  user: typeof OWNER | null
): Promise<{ context: BrowserContext; page: Page }> {
  const viewport = { width: 1280, height: 1200 };
  const context = user
    ? await signedInContext(browser, stack.baseURL, user, { viewport })
    : await browser.newContext({ baseURL: stack.baseURL, viewport });

  return { context, page: await context.newPage() };
}

function card(page: Page, name: string) {
  return page.locator("[data-recipe-card]").filter({ hasText: name }).first();
}

/** The Filters panel's Category chips, opened from the Library. */
async function openFilters(page: Page) {
  await page.getByRole("button", { name: "Filters" }).click();
  const panel = page.getByRole("dialog");

  await expect(panel.getByRole("button", { name: "Breakfast", exact: true })).toBeVisible();

  return panel;
}

test("a household adds Drinks from the form and filters by it; another is never offered it", async ({
  browser,
  aiStack,
}) => {
  const word = `Cat${Date.now().toString(36)}`;
  const mojito = `${word} Mojito`;
  const stew = `${word} Stew`;
  // Household A is the member; household B the owner, who may view every recipe.
  const aCookies = await signIn(aiStack.baseURL, MEMBER);
  const aId = await userIdOf(MEMBER);
  // The form saves only a recipe with a line and a step.
  const mojitoId = await seedRecipe(aId, mojito, ["mint"], {
    steps: [{ step: "Muddle the mint", systemUsed: "metric", order: 0 }],
  });
  const bRecipeId = await seedRecipe(await userIdOf(OWNER), `${word} Soup`);

  await seedRecipe(aId, stew);
  await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
    view: "everyone",
    edit: "household",
    delete: "household",
  });

  const a = await openPage(browser, aiStack, MEMBER);
  // A second tab of household A, already on the Library while the recipe is saved.
  const library = await a.context.newPage();

  try {
    await library.goto("/");
    await library.locator("#search-input").fill(word);
    await expect(card(library, stew)).toBeVisible();

    await a.page.goto(`/recipes/edit/${mojitoId}`);
    await expect(a.page.getByLabel("Recipe Name")).toHaveValue(mojito);
    // The form fills its lines once units load; a save before that finds none.
    await expect
      .poll(() =>
        a.page
          .locator("textarea")
          .evaluateAll((all) => all.map((el) => (el as HTMLTextAreaElement).value))
      )
      .toContain("Muddle the mint");
    await a.page.getByRole("textbox", { name: "Add a category" }).fill("Drinks");
    await a.page.getByRole("textbox", { name: "Add a category" }).press("Enter");
    await expect(a.page.getByRole("button", { name: "Drinks", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await a.page.getByRole("button", { name: "Save Changes" }).click();
    await waitForRecipe(aiStack.baseURL, aCookies, mojitoId, (recipe) =>
      recipe.categories.includes("Drinks")
    );

    // The open Library offers the new Category without a reload.
    const filters = await openFilters(library);
    const drinks = filters.getByRole("button", { name: "Drinks", exact: true });

    await expect(drinks).toBeVisible();
    await drinks.click();
    await filters.getByRole("button", { name: "Apply" }).click();
    await expect(card(library, mojito)).toBeVisible();
    await expect(card(library, stew)).toBeHidden();
  } finally {
    await a.context.close();
  }

  const b = await openPage(browser, aiStack, OWNER);

  try {
    await b.page.goto(`/recipes/edit/${bRecipeId}`);
    await expect(b.page.getByRole("button", { name: "Breakfast", exact: true })).toBeVisible();
    await expect(b.page.getByRole("button", { name: "Drinks", exact: true })).toHaveCount(0);

    await b.page.goto("/");
    const filters = await openFilters(b.page);

    await expect(filters.getByRole("button", { name: "Drinks", exact: true })).toHaveCount(0);

    await b.page.goto(`/recipes/${mojitoId}`);
    await expect(
      b.page.getByText("Drinks", { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
  } finally {
    await b.context.close();
  }

  // The public share view shows it verbatim too.
  const { url } = await callTrpc<{ url: string }>(
    aiStack.baseURL,
    aCookies,
    "recipes.shareCreate",
    {
      recipeId: mojitoId,
    }
  );
  const visitor = await openPage(browser, aiStack, null);

  try {
    await visitor.page.goto(url);
    await expect(
      visitor.page.getByText("Drinks", { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
  } finally {
    await visitor.context.close();
  }
});
