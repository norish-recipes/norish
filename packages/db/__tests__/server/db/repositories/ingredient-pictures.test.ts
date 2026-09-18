// @vitest-environment node
/**
 * Ingredient Illustrations on Ingredient Names (ADR-0037).
 *
 * A picture belongs to the row a line points at, so these tests are about what
 * a reader is handed as pictures come and go, and about the refusals that keep
 * a used name from being deleted — none of which a mock can prove.
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminIngredientDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import {
  createIngredientWithDetails,
  deleteIngredientIfUnused,
  findIngredientForAdmin,
  listIngredientIdsMissingImage,
  listIngredientNames,
  listIngredientsForAdmin,
  setIngredientImage,
  updateIngredientDetails,
} from "@norish/db/repositories/ingredient-pictures";
import {
  getOrCreateManyIngredients,
  listIngredientNamesMissingNormalizedName,
  setIngredientNormalizedNames,
} from "@norish/db/repositories/ingredients";
import { createPantryIngredient } from "@norish/db/repositories/pantry";
import { mapRecipeToPublicRecipeView } from "@norish/db/repositories/recipe-share-helpers";
import { createRecipeWithRefs, getRecipeFull } from "@norish/db/repositories/recipes";
import { ingredients } from "@norish/db/schema";

import { createTestUser } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const testBase = new RepositoryTestBase("test_ingredient_pictures");

beforeAll(async () => await testBase.setup());
afterAll(async () => await testBase.teardown());
beforeEach(async () => await testBase.beforeEachTest());

async function create(name: string): Promise<AdminIngredientDto> {
  const result = await createIngredientWithDetails({ name });

  if (result.status !== "ok") throw new Error(`create failed: ${result.status}`);

  return result.ingredient;
}

/** The Ingredient Name this name resolves to, minting it if Norish has none. */
async function idOf(name: string): Promise<string> {
  const [resolved] = await getOrCreateManyIngredients([name]);

  return resolved!.id;
}

async function pictureOf(name: string): Promise<string | null | undefined> {
  return (await findIngredientForAdmin(await idOf(name)))?.imageUrl;
}

async function createRecipeUsing(names: string[]): Promise<string> {
  const user = await createTestUser();
  const recipeId = crypto.randomUUID();

  // An archive import carries names, never instance-local ids (ADR-0022).
  await createRecipeWithRefs(recipeId, user.id, {
    name: "Omelette",
    systemUsed: "metric",
    recipeIngredients: names.map((ingredientName, order) => ({
      ingredientId: null,
      ingredientName,
      amount: null,
      unit: null,
      order,
      systemUsed: "metric" as const,
    })),
    tags: [],
    cuisines: [],
    categories: [],
    steps: [],
    images: [],
    videos: [],
  });

  return recipeId;
}

describe("creating and listing", () => {
  it("stores a name and lists every name with its usage", async () => {
    const egg = await create("Egg");

    expect(egg).toMatchObject({ name: "Egg", imageUrl: null, version: 1, recipeCount: 0 });

    await createRecipeUsing(["chives"]);

    const page = await listIngredientsForAdmin({});

    expect(page.items.map((row) => [row.name, row.recipeCount])).toEqual([
      ["chives", 1],
      ["Egg", 0],
    ]);
    expect(page.nextCursor).toBeNull();
    expect((await listIngredientsForAdmin({ search: "gg" })).items).toEqual([egg]);
  });

  it("pages", async () => {
    const apple = await create("Apple");
    const banana = await create("Banana");

    const first = await listIngredientsForAdmin({ limit: 1 });

    expect(first.items.map((row) => row.id)).toEqual([apple.id]);
    expect(first.nextCursor).toBe(1);
    expect(
      (await listIngredientsForAdmin({ cursor: 1, limit: 1 })).items.map((row) => row.id)
    ).toEqual([banana.id]);
  });

  it("refuses a name another Ingredient Name already has, naming it", async () => {
    await create("Coriander");

    expect(await createIngredientWithDetails({ name: "coriander" })).toEqual({
      status: "duplicate",
      name: "coriander",
      ownerName: "Coriander",
    });
  });

  it("refuses a name that folds to nothing", async () => {
    expect(await createIngredientWithDetails({ name: "!!!" })).toEqual({
      status: "invalid-name",
      name: "!!!",
    });
  });

  it("lists every name for devices, so the editor suggests names without pictures too", async () => {
    const [salt] = await getOrCreateManyIngredients(["salt"]);
    const egg = await create("Egg");
    const leek = await create("Leek");

    await setIngredientImage(leek.id, "/ingredient-images/l.webp");

    expect(await listIngredientNames()).toEqual([
      { id: egg.id, name: "Egg", imageUrl: null },
      { id: leek.id, name: "Leek", imageUrl: "/ingredient-images/l.webp" },
      { id: salt!.id, name: "salt", imageUrl: null },
    ]);
  });
});

describe("the picture a line shows", () => {
  it("shows the picture drawn for it, and nothing borrowed from another name", async () => {
    const egg = await create("Egg");

    await setIngredientImage(egg.id, "/ingredient-images/egg.webp");

    expect(await pictureOf("Egg")).toBe("/ingredient-images/egg.webp");
    // Case is all a name may differ by: the row is found by `lower(name)`.
    expect(await pictureOf("EGG")).toBe("/ingredient-images/egg.webp");
    // A different name is a different ingredient, and has no picture of its own.
    expect(await pictureOf("free-range egg")).toBeNull();
  });

  it("reaches recipe lines and the share view from the row they point at", async () => {
    const egg = await create("Egg");

    await setIngredientImage(egg.id, "/ingredient-images/egg.webp");

    const full = await getRecipeFull(await createRecipeUsing(["Egg", "chives"]));

    expect(full?.recipeIngredients.map((line) => line.picture)).toEqual([
      { imageUrl: "/ingredient-images/egg.webp" },
      null,
    ]);

    const shared = mapRecipeToPublicRecipeView(full!, "share-token");

    expect(shared.recipeIngredients.map((line) => line.picture)).toEqual([
      { imageUrl: "/ingredient-images/egg.webp" },
      null,
    ]);
  });
});

describe("updates and deletes", () => {
  it("refuses a stale version and a missing name", async () => {
    const salt = await create("Salt");

    await updateIngredientDetails({ id: salt.id, version: 1, name: "Sea salt" });

    expect(await updateIngredientDetails({ id: salt.id, version: 1, name: "Salt" })).toEqual({
      status: "stale",
    });
    expect(
      await updateIngredientDetails({ id: crypto.randomUUID(), version: 1, name: "Salt" })
    ).toEqual({ status: "not-found" });
  });

  it("renames a name and its folded form together", async () => {
    const lime = await create("Lime");
    const result = await updateIngredientDetails({
      id: lime.id,
      version: lime.version,
      name: "Key lime",
    });

    expect(result).toMatchObject({ status: "ok", ingredient: { name: "Key lime", version: 2 } });

    const [row] = await db.select().from(ingredients).where(eq(ingredients.id, lime.id));

    expect(row).toMatchObject({ normalizedName: "key lime" });
  });

  it("refuses to delete a name a recipe uses, and deletes an unused one", async () => {
    await createRecipeUsing(["butter"]);
    const butter = await idOf("butter");
    const spare = await create("Spare");

    await setIngredientImage(spare.id, "/ingredient-images/s.webp");

    expect(await deleteIngredientIfUnused(butter)).toEqual({
      status: "in-use",
      recipeCount: 1,
      pantryCount: 0,
    });
    expect(await findIngredientForAdmin(butter)).not.toBeNull();
    expect(await deleteIngredientIfUnused(spare.id)).toEqual({ status: "ok" });
    expect(await deleteIngredientIfUnused(spare.id)).toEqual({ status: "not-found" });
  });

  it("refuses to delete a name a household keeps in its Pantry", async () => {
    const user = await createTestUser();
    const staple = await create("Olive oil");

    await createPantryIngredient(crypto.randomUUID(), { userId: user.id, name: "Olive oil" });

    expect(await deleteIngredientIfUnused(staple.id)).toEqual({
      status: "in-use",
      recipeCount: 0,
      pantryCount: 1,
    });
    expect(await findIngredientForAdmin(staple.id)).not.toBeNull();
  });
});

describe("pictures", () => {
  it("hands back the replaced picture without a version bump", async () => {
    const leek = await create("Leek");

    expect(await setIngredientImage(leek.id, "/ingredient-images/1.webp")).toEqual({
      previousImageUrl: null,
    });
    expect(await setIngredientImage(leek.id, "/ingredient-images/2.webp")).toEqual({
      previousImageUrl: "/ingredient-images/1.webp",
    });
    expect(await findIngredientForAdmin(leek.id)).toMatchObject({
      imageUrl: "/ingredient-images/2.webp",
      // A picture never makes the editor's name draft stale.
      version: 1,
    });
    expect(await setIngredientImage(crypto.randomUUID(), null)).toBeUndefined();
  });

  it("lists names worth drawing: used by a recipe, without a picture", async () => {
    await create("Unused");
    await createRecipeUsing(["apple", "cherry"]);

    const apple = await idOf("apple");

    await setIngredientImage(apple, "/ingredient-images/a.webp");

    // "Unused" is nobody's ingredient yet, so nothing is billed to draw it.
    expect(await listIngredientIdsMissingImage()).toEqual([await idOf("cherry")]);
  });
});

describe("the normalized-name backfill", () => {
  it("folds a name written before the folding existed", async () => {
    const creme = await create("Crème Fraîche");

    await setIngredientImage(creme.id, "/ingredient-images/c.webp");
    // Simulate a row written before the column existed.
    await db.update(ingredients).set({ normalizedName: null }).where(eq(ingredients.id, creme.id));

    // Its own name still reaches it, because that match needs no fold.
    expect(await idOf("Crème Fraîche")).toBe(creme.id);

    const pending = await listIngredientNamesMissingNormalizedName(10);

    expect(pending.map((row) => row.name)).toEqual(["Crème Fraîche"]);

    await setIngredientNormalizedNames([{ id: creme.id, normalizedName: "creme fraiche" }]);

    expect(await listIngredientNamesMissingNormalizedName(10)).toEqual([]);

    const [row] = await db.select().from(ingredients).where(eq(ingredients.id, creme.id));

    // Folded, a grocery row written "creme fraiche" finds it in the browser.
    expect(row).toMatchObject({ normalizedName: "creme fraiche" });
  });
});
