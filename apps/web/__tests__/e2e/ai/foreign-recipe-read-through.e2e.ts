/**
 * Another household's recipe reads through your own catalogue (ADR-0042), in a browser, under view
 * Everyone. Household A writes "sjalot" and "prei"; household B keeps its own "sjalot" in its Pantry.
 * B's add-to-groceries panel holds A's "sjalot" line as in the Pantry, the Library's pantry filter
 * counts it, adding the lines gives B foods of its own catalogue and none of A's, and A's recipe and
 * foods are left as they are. B sees A's food icons only through A's recipe, never by id.
 */
import type { GroceryDto } from "@norish/shared/contracts";

import { signedInContext, signIn } from "../harness/auth";
import { createRecipe, readRecipe } from "../harness/recipes";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { expect, MEMBER, OWNER, test } from "./fixture";

interface ListedFood {
  id: string;
  name: string;
}

test("another household's recipe is used through the reader's own catalogue", async ({
  browser,
  aiStack,
}) => {
  const word = `Rt${Date.now().toString(36)}`;
  const shallot = `${word} sjalot`;
  const leek = `${word} prei`;
  const title = `${word} A's soup`;
  // Household A is the member; household B the owner.
  const aCookies = await signIn(aiStack.baseURL, MEMBER);
  const bCookies = aiStack.ownerCookies;
  const foodsOf = async (cookies: typeof bCookies, search: string) =>
    (
      await queryTrpc<{ items: ListedFood[] }>(aiStack.baseURL, cookies, "ingredients.list", {
        search,
        locale: "en",
      })
    ).items;

  await callTrpc(aiStack.baseURL, bCookies, "admin.updateRecipePermissionPolicy", {
    view: "everyone",
    edit: "household",
    delete: "household",
  });
  const recipeId = await createRecipe(aiStack.baseURL, aCookies, title, [shallot, leek]);
  const stored = (await readRecipe(aiStack.baseURL, aCookies, recipeId))!;
  const aShallot = stored.recipeIngredients[0]!.ingredientId!;
  const aLeek = stored.recipeIngredients[1]!.ingredientId!;
  const added = await callTrpc<{ ingredient: ListedFood | null }>(
    aiStack.baseURL,
    bCookies,
    "ingredients.add",
    { name: shallot, spellings: [], locale: "en" }
  );
  const bShallot = added.ingredient!.id;

  expect(bShallot).not.toBe(aShallot);
  await callTrpc(aiStack.baseURL, bCookies, "pantry.add", {
    id: crypto.randomUUID(),
    ingredientId: bShallot,
  });

  // The Library's pantry filter counts A's "sjalot" line by B's Pantry.
  const library = await queryTrpc<{
    items: Array<{ kind: string; recipe?: { id: string; pantryCoverage: number | null } }>;
  }>(aiStack.baseURL, bCookies, "library.list", {
    limit: 50,
    cursor: 0,
    pantryOnly: true,
    search: word,
  });

  expect(library.items.find((item) => item.recipe?.id === recipeId)?.recipe).toMatchObject({
    pantryCoverage: 0.5,
  });

  // A's foods show on A's recipe, and through it alone.
  await expect(
    queryTrpc(aiStack.baseURL, bCookies, "ingredients.icons", { ids: [aShallot, aLeek], recipeId })
  ).resolves.toEqual({ [aShallot]: null, [aLeek]: null });
  await expect(
    queryTrpc(aiStack.baseURL, bCookies, "ingredients.icons", { ids: [aShallot] })
  ).resolves.toEqual({});
  await expect(
    queryTrpc(aiStack.baseURL, bCookies, "ingredients.get", { ingredientId: aShallot })
  ).resolves.toBeNull();

  const context = await signedInContext(browser, aiStack.baseURL, OWNER, {
    viewport: { width: 1280, height: 1200 },
  });

  try {
    const page = await context.newPage();

    await page.goto(`/recipes/${recipeId}`);
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    const panel = page.getByRole("dialog", { name: "Add to Groceries" });

    await expect(
      panel.getByTestId("pantry-section").getByRole("checkbox", { name: shallot })
    ).toBeVisible();
    await expect(
      panel.getByTestId("to-buy-section").getByRole("checkbox", { name: leek })
    ).toBeChecked();
    await panel.getByTestId("pantry-section").getByRole("checkbox", { name: shallot }).check();
    await panel.getByRole("button", { name: "Add", exact: true }).click();
    await expect(panel).toBeHidden();
  } finally {
    await context.close();
  }

  // Each of B's rows names its own line's food of B's catalogue under B's spelling: its own
  // "sjalot", and the "prei" adding it made there; none of A's.
  const lineIds = stored.recipeIngredients.flatMap((line) => (line.id ? [line.id] : []));
  const rows = async () => {
    const { groceries } = await callTrpc<{ groceries: GroceryDto[] }>(
      aiStack.baseURL,
      bCookies,
      "groceries.list"
    );

    return groceries
      .flatMap((grocery) =>
        grocery.recipeIngredientId && lineIds.includes(grocery.recipeIngredientId)
          ? [{ line: grocery.recipeIngredientId, name: grocery.name, food: grocery.ingredientId }]
          : []
      )
      .sort((a, b) => lineIds.indexOf(a.line) - lineIds.indexOf(b.line));
  };

  await expect.poll(async () => (await rows()).length).toBe(2);
  const bLeek = (await foodsOf(bCookies, leek)).find((food) => food.name === leek)?.id;

  expect(bLeek).toBeDefined();
  expect(bLeek).not.toBe(aLeek);
  await expect(rows()).resolves.toEqual([
    { line: lineIds[0], name: shallot, food: bShallot },
    { line: lineIds[1], name: leek, food: bLeek },
  ]);
  for (const food of [bShallot, bLeek]) {
    // B reads by id only the foods of its own catalogue.
    await expect(
      queryTrpc<ListedFood | null>(aiStack.baseURL, bCookies, "ingredients.get", {
        ingredientId: food,
      })
    ).resolves.toMatchObject({ id: food });
  }

  // A's recipe and A's own foods are as they were.
  const after = (await readRecipe(aiStack.baseURL, aCookies, recipeId))!;

  expect(after.recipeIngredients.map((line) => line.ingredientId)).toEqual([aShallot, aLeek]);
  const byId = (a: string, b: string) => a.localeCompare(b);

  expect((await foodsOf(aCookies, word)).map((food) => food.id).sort(byId)).toEqual(
    [aShallot, aLeek].sort(byId)
  );
});
