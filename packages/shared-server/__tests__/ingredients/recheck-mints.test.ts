// @vitest-environment node
/**
 * The startup pass over old undecided mints, against a real database:
 * mints an instance's history left behind ("salt to taste", "verse
 * peterselie") reach the seeded Ingredients they name once the resolver's
 * rules improve, a person's decisions are left alone, and the pass runs once
 * per rung version.
 */
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { createRecipeWithRefs, getRecipeFull } from "@norish/db";
import { listAIChanges } from "@norish/db/repositories/ingredient-ai-changes";
import {
  applyIngredientSeed,
  fileUndecidedMint,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import { groceries, ingredients, serverConfig } from "@norish/db/schema";
import { parentByAI } from "@norish/shared-server/ingredients/ai-changes";
import { listIngredients, markDistinct } from "@norish/shared-server/ingredients/catalogue";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";
import { RUNG_VERSION } from "@norish/shared-server/ingredients/resolver";
import { readIngredientSeedState } from "@norish/shared-server/ingredients/seed/catalogue-seed";
import { recheckUndecidedMintsOnRungChange } from "@norish/shared-server/ingredients/seed/recheck-mints";

import {
  getTestDb,
  mintTestFood,
  nameInATestRecipe,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { seedEntry } from "../helpers/seed-entries";

describe("looking at old undecided mints again", () => {
  const testBase = new RepositoryTestBase("test_recheck_mints");

  let actor: CatalogueActor;
  let seeded: Map<string, string>;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = { userId: user.id, householdUserIds: null, isServerAdmin: true };
    await getTestDb()
      .delete(serverConfig)
      .where(eq(serverConfig.key, ServerConfigKeys.INGREDIENT_SEED_STATE));
    await applyIngredientSeed([
      seedEntry("en:salt", "salt", "zout"),
      seedEntry("en:parsley", "parsley", "peterselie"),
      seedEntry("en:cumin", "cumin"),
      seedEntry("en:garlic", "garlic"),
      seedEntry("en:chickpea", "chickpeas"),
      seedEntry("en:tea", "tea", "te"),
      seedEntry("en:oil", "oil", "olie"),
    ]);
    seeded = await listSeededIngredientIds();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A mint as the resolver made it before its rules changed: the text whole, flagged. */
  async function legacyMint(text: string): Promise<string> {
    const minted = await mintTestFood(text, {
      ownerId: actor.userId,
      flagged: true,
      flagReason: "upgrade",
    });

    // A recipe names it, so AI may change it too.
    await nameInATestRecipe(actor.userId, minted.aliasId, text);

    return minted.ingredientId;
  }

  async function shown(id: string) {
    return (await listIngredients(actor, { id })).items[0] ?? null;
  }

  it("merges a legacy mint into the food it now resolves to, and its lines follow", async () => {
    const legacy = await legacyMint("salt to taste");
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(
      recipeId,
      actor.userId,
      await withResolvedIngredients(
        {
          name: "Soup",
          systemUsed: "metric",
          recipeIngredients: [
            {
              ingredientId: null,
              ingredientName: "salt to taste",
              amount: null,
              unit: null,
              order: 0,
            },
          ],
        },
        { userId: actor.userId }
      )
    );

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 1, filed: 0 });

    expect(await shown(legacy)).toBeNull();
    expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
      { ingredientName: "salt to taste", ingredientId: seeded.get("en:salt") },
    ]);
  });

  it("files a legacy mint under the seeded food its name ends with, still flagged", async () => {
    const legacy = await legacyMint("verse peterselie");

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 0, filed: 1 });
    expect(await shown(legacy)).toMatchObject({
      flagged: true,
      parent: { id: seeded.get("en:parsley") },
    });
  });

  it("rechecks an unflagged mint no person decided about, as one made today", async () => {
    const merged = await legacyMint("salt to taste");
    const filed = await legacyMint("verse peterselie");

    await getTestDb()
      .update(ingredients)
      .set({ flagged: false, flagReason: null })
      .where(inArray(ingredients.id, [merged, filed]));

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 1, filed: 1 });
    expect(await shown(merged)).toBeNull();
    expect(await shown(filed)).toMatchObject({
      flagged: false,
      parent: { id: seeded.get("en:parsley") },
    });
  });

  it("leaves an unflagged mint a person decided about alone", async () => {
    const distinct = await legacyMint("naar smaak zout");
    const parented = await legacyMint("ground cumin");

    await markDistinct(actor, distinct);
    await getTestDb()
      .update(ingredients)
      .set({ parentId: seeded.get("en:salt")!, parentChosen: true, flagged: false })
      .where(eq(ingredients.id, parented));

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 0, filed: 0 });
    expect(await shown(distinct)).toMatchObject({ flagged: false });
    expect(await shown(parented)).toMatchObject({ parent: { id: seeded.get("en:salt") } });
  });

  it("leaves a grocery food alone: no parent from its words, no merge", async () => {
    const grocery = async (text: string) => {
      const minted = await mintTestFood(text, {
        ownerId: actor.userId,
        flagged: true,
        flagReason: "upgrade",
      });

      await getTestDb().insert(groceries).values({
        userId: actor.userId,
        name: text,
        ingredientAliasId: minted.aliasId,
        ingredientId: minted.ingredientId,
      });

      return minted.ingredientId;
    };
    const parsley = await grocery("verse peterselie");
    const salt = await grocery("salt to taste");

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 0, filed: 0 });
    const row = async (id: string) =>
      (
        await getTestDb()
          .select({ parentId: ingredients.parentId })
          .from(ingredients)
          .where(eq(ingredients.id, id))
      )[0];

    await expect(row(parsley)).resolves.toEqual({ parentId: null });
    await expect(row(salt)).resolves.toEqual({ parentId: null });
  });

  it("merges a legacy mint whose preparation was written without a comma", async () => {
    const legacy = await legacyMint("can of chickpeas drained and rinsed");

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 1, filed: 0 });
    expect(await shown(legacy)).toBeNull();
  });

  it("gives a legacy mint its plain name, so its siblings merge into it", async () => {
    const crushed = await legacyMint("garlic cloves crushed");
    const sliced = await legacyMint("garlic cloves thinly sliced");
    const chopped = await legacyMint("garlic cloves, finely chopped");

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 2, filed: 0 });
    expect(await shown(sliced)).toBeNull();
    expect(await shown(chopped)).toBeNull();
    // Garlic starts the name before no cut alone, so it gives no parent.
    expect(await shown(crushed)).toMatchObject({
      name: "garlic cloves",
      flagged: true,
      parent: null,
    });
    expect(await listAIChanges()).toHaveLength(0);
    expect((await shown(crushed))!.aliases.map((alias) => alias.text).sort()).toEqual([
      "garlic cloves",
      "garlic cloves crushed",
      "garlic cloves thinly sliced",
      "garlic cloves, finely chopped",
    ]);
  });

  it("files a legacy mint under the food it is read up to a note as, and leaves AI's", async () => {
    const oil = await legacyMint("olie om te bakken");
    const answered = await legacyMint("zwarte te bakken");

    await parentByAI(answered, seeded.get("en:tea")!, false);

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 0, filed: 1 });
    expect(await shown(oil)).toMatchObject({ flagged: true, parent: { id: seeded.get("en:oil") } });
    expect(await shown(answered)).toMatchObject({ parent: { id: seeded.get("en:tea") } });
    expect(
      (await listAIChanges()).map((change) => [change.ingredient?.id, change.target?.id])
    ).toEqual([[answered, seeded.get("en:tea")]]);
  });

  it("leaves a mint AI took a parent from without one, sure or not", async () => {
    const legacy = await legacyMint("ground cumin");

    await fileUndecidedMint(legacy, seeded.get("en:cumin")!);
    await parentByAI(legacy, null, false);

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 0, filed: 0 });
    expect(await shown(legacy)).toMatchObject({ flagged: true, parent: null });
    expect(await listAIChanges()).toMatchObject([{ target: null, sure: false }]);
  });

  it("leaves alone what a person decided, even under a flag raised again since", async () => {
    const distinct = await legacyMint("naar smaak zout");
    const parented = await legacyMint("ground cumin");

    await markDistinct(actor, distinct);
    await getTestDb()
      .update(ingredients)
      .set({ flagged: true })
      .where(eq(ingredients.id, distinct));
    await getTestDb()
      .update(ingredients)
      .set({ parentId: seeded.get("en:salt")!, parentChosen: true })
      .where(eq(ingredients.id, parented));

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 0, filed: 0 });
    expect(await shown(distinct)).not.toBeNull();
    expect(await shown(parented)).toMatchObject({ parent: { id: seeded.get("en:salt") } });
  });

  it("runs once per rung version: a second boot does nothing", async () => {
    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 0, filed: 0 });
    expect((await readIngredientSeedState()).rungVersion).toBe(RUNG_VERSION);

    const legacy = await legacyMint("salt to taste");

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toBeNull();
    expect(await shown(legacy)).not.toBeNull();
  });
});
