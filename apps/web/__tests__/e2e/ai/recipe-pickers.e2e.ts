/**
 * The recipe form's Tag, Cuisine and Category pickers search the household's list as you type
 * and make an entry only through their "Create" row (ADR-0043): a new Tag and Cuisine are made
 * from the picker and saved on the recipe, an existing one typed in another case is picked
 * instead of made twice, and a name that is typed but never created is not saved.
 */
import type { Page } from "@playwright/test";

import { userIdOf } from "../harness/accounts";
import { signedInContext, signIn } from "../harness/auth";
import { seedRecipe, waitForRecipe } from "../harness/recipes";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { expect, MEMBER, test } from "./fixture";

type Entry = { id: string; name: string };
type Kind = "tag" | "cuisine" | "category";

/** The form fills its lines once units load; a save before that finds none. */
async function openEditor(page: Page, recipeId: string, name: string) {
  await page.goto(`/recipes/edit/${recipeId}`);
  await expect(page.getByLabel("Recipe Name")).toHaveValue(name);
  await expect
    .poll(() =>
      page
        .locator("textarea")
        .evaluateAll((all) => all.map((el) => (el as HTMLTextAreaElement).value))
    )
    .toContain("Stir");
}

test("a Tag and a Cuisine are made from the picker, and an existing one is picked by another case", async ({
  browser,
  aiStack,
}) => {
  const word = `Pick${Date.now().toString(36)}`;
  const recipeName = `${word} Soup`;
  const existingTag = `${word} Smoky BBQ`;
  const newTag = `${word} Grilled`;
  const typedOnly = `${word} Typed only`;
  const newCuisine = `${word} Peruvian`;
  const cookies = await signIn(aiStack.baseURL, MEMBER);
  const recipeId = await seedRecipe(await userIdOf(MEMBER), recipeName, ["leek"], {
    steps: [{ step: "Stir", systemUsed: "metric", order: 0 }],
  });
  const list = (kind: Kind) => queryTrpc<Entry[]>(aiStack.baseURL, cookies, "lists.list", { kind });

  await callTrpc(aiStack.baseURL, cookies, "lists.add", { kind: "tag", name: existingTag });

  const context = await signedInContext(browser, aiStack.baseURL, MEMBER, {
    viewport: { width: 1280, height: 1400 },
  });

  try {
    const page = await context.newPage();

    await openEditor(page, recipeId, recipeName);

    // An existing Tag typed in lowercase is picked, and no Create row is offered for it.
    const tags = page.getByRole("combobox", { name: "Add a tag" });

    await tags.fill(existingTag.toLowerCase());
    await expect(page.getByRole("option", { name: existingTag, exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: /^Create/ })).toHaveCount(0);
    await page.getByRole("option", { name: existingTag, exact: true }).click();
    await expect(page.getByRole("button", { name: `Remove ${existingTag}` })).toBeVisible();

    // A new Tag is made by its Create row, at once, and picked.
    await tags.fill(newTag);
    await page.getByRole("option", { name: `Create "${newTag}"` }).click();
    await expect(page.getByRole("button", { name: `Remove ${newTag}` })).toBeVisible();
    await expect.poll(async () => (await list("tag")).map((tag) => tag.name)).toContain(newTag);

    // A name typed and left is never made.
    await tags.fill(typedOnly);
    await expect(page.getByRole("option", { name: `Create "${typedOnly}"` })).toBeVisible();
    await tags.press("Escape");

    // Cuisines: an instance Cuisine in another case, then one made here.
    const cuisines = page.getByRole("combobox", { name: "Cuisines" });

    await cuisines.fill("italian");
    await page.getByRole("option", { name: "Italian", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove Italian" })).toBeVisible();
    await cuisines.fill(newCuisine);
    await page.getByRole("option", { name: `Create "${newCuisine}"` }).click();
    await expect(page.getByRole("button", { name: `Remove ${newCuisine}` })).toBeVisible();

    await page.getByRole("button", { name: "Save Changes" }).click();
    const saved = await waitForRecipe(aiStack.baseURL, cookies, recipeId, (recipe) =>
      recipe.cuisines.some((cuisine) => cuisine.name === newCuisine)
    );

    const byName = (a: string, b: string) => a.localeCompare(b);

    expect(saved.tags.map((tag) => tag.name).sort(byName)).toEqual(
      [existingTag, newTag].sort(byName)
    );
    expect(saved.cuisines.map((cuisine) => cuisine.name).sort(byName)).toEqual(
      ["Italian", newCuisine].sort(byName)
    );

    const tagNames = (await list("tag")).map((tag) => tag.name);
    const cuisineNames = (await list("cuisine")).map((cuisine) => cuisine.name);

    // Saving made nothing: the typed name is no entry, and nothing was made twice.
    expect(tagNames).not.toContain(typedOnly);
    expect(
      tagNames.filter((name) => name.toLowerCase() === existingTag.toLowerCase())
    ).toHaveLength(1);
    expect(cuisineNames.filter((name) => name === "Italian")).toHaveLength(1);
  } finally {
    await context.close();
  }
});

test("a name typed in a picker and never created through its Create row is not made by saving", async ({
  browser,
  aiStack,
}) => {
  const word = `Left${Date.now().toString(36)}`;
  const recipeName = `${word} Stew`;
  const existingTag = `${word} Smoky`;
  const typedTag = `${word} Typed tag`;
  const typedCategory = `${word} Typed category`;
  const cookies = await signIn(aiStack.baseURL, MEMBER);
  const recipeId = await seedRecipe(await userIdOf(MEMBER), recipeName, ["leek"], {
    steps: [{ step: "Stir", systemUsed: "metric", order: 0 }],
  });
  const names = async (kind: Kind) =>
    (await queryTrpc<Entry[]>(aiStack.baseURL, cookies, "lists.list", { kind })).map(
      (entry) => entry.name
    );

  await callTrpc(aiStack.baseURL, cookies, "lists.add", { kind: "tag", name: existingTag });

  const context = await signedInContext(browser, aiStack.baseURL, MEMBER, {
    viewport: { width: 1280, height: 1400 },
  });

  try {
    const page = await context.newPage();

    await openEditor(page, recipeId, recipeName);

    // An existing Tag is picked, so the save has something to store.
    const tags = page.getByRole("combobox", { name: "Add a tag" });

    await tags.fill(existingTag);
    await page.getByRole("option", { name: existingTag, exact: true }).click();
    await expect(page.getByRole("button", { name: `Remove ${existingTag}` })).toBeVisible();

    // A new Tag and a new Category are typed, their Create rows offered, and neither is taken.
    await tags.fill(typedTag);
    await expect(page.getByRole("option", { name: `Create "${typedTag}"` })).toBeVisible();
    await page.getByLabel("Recipe Name").click();

    const categories = page.getByRole("combobox", { name: "Add a category" });

    await categories.fill(typedCategory);
    await expect(page.getByRole("option", { name: `Create "${typedCategory}"` })).toBeVisible();
    await page.getByLabel("Recipe Name").click();

    await page.getByRole("button", { name: "Save Changes" }).click();

    const saved = await waitForRecipe(aiStack.baseURL, cookies, recipeId, (recipe) =>
      recipe.tags.some((tag) => tag.name === existingTag)
    );

    expect(saved.tags.map((tag) => tag.name)).toEqual([existingTag]);
    expect(saved.categories).not.toContain(typedCategory);
    expect(await names("tag")).not.toContain(typedTag);
    expect(await names("category")).not.toContain(typedCategory);
  } finally {
    await context.close();
  }
});
