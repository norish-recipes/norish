// @vitest-environment node
/**
 * The startup pass over old Flagged Ingredients, against a real database:
 * mints an instance's history left behind ("salt to taste", "verse
 * peterselie") reach the seeded Ingredients they name once the resolver's
 * rules improve, a person's decisions are left alone, and the pass runs once
 * per rung version.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SeedEntry } from "@norish/db/repositories/ingredient-seed";
import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { createRecipeWithRefs, getRecipeFull } from "@norish/db";
import { mintIngredientWithAliases } from "@norish/db/repositories/ingredient-aliases";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import { listIngredientSuggestions } from "@norish/db/repositories/ingredient-suggestions";
import { ingredients, serverConfig } from "@norish/db/schema";
import { listIngredients, markDistinct } from "@norish/shared-server/ingredients/catalogue";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";
import { RUNG_VERSION } from "@norish/shared-server/ingredients/resolver";
import { readIngredientSeedState } from "@norish/shared-server/ingredients/seed/catalogue-seed";
import { recheckUndecidedMintsOnRungChange } from "@norish/shared-server/ingredients/seed/recheck-mints";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

function entry(offId: string, ...names: string[]): SeedEntry {
  return {
    offId,
    name: names[0]!,
    nameFold: ingredientAliasFold(names[0]!),
    parentOffId: null,
    nutrition: null,
    aliases: names.map((text) => ({ text, fold: ingredientAliasFold(text), locale: null })),
  };
}

describe("looking at old Flagged Ingredients again", () => {
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
      entry("en:salt", "salt", "zout"),
      entry("en:parsley", "parsley", "peterselie"),
      entry("en:cumin", "cumin"),
      entry("en:garlic", "garlic"),
      entry("en:chickpea", "chickpeas"),
    ]);
    seeded = await listSeededIngredientIds();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A mint as the resolver made it before its rules changed: the text whole, flagged. */
  async function legacyMint(text: string): Promise<string> {
    const [row] = await mintIngredientWithAliases({
      name: text,
      aliases: [{ text, fold: ingredientAliasFold(text) }],
      ownerId: actor.userId,
      locale: null,
      flagged: true,
      flagReason: "upgrade",
    });

    return row!.ingredientId;
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

  it("merges a legacy mint whose preparation was written without a comma", async () => {
    const legacy = await legacyMint("can of chickpeas drained and rinsed");

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 1, filed: 0 });
    expect(await shown(legacy)).toBeNull();
  });

  it("gives a legacy mint its plain name, so its siblings merge into it", async () => {
    const crushed = await legacyMint("garlic cloves crushed");
    const sliced = await legacyMint("garlic cloves thinly sliced");
    const chopped = await legacyMint("garlic cloves, finely chopped");

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 2, filed: 1 });
    expect(await shown(sliced)).toBeNull();
    expect(await shown(chopped)).toBeNull();
    expect(await shown(crushed)).toMatchObject({
      name: "garlic cloves",
      flagged: true,
      parent: { id: seeded.get("en:garlic") },
    });
    expect((await shown(crushed))!.aliases.map((alias) => alias.text).sort()).toEqual([
      "garlic cloves",
      "garlic cloves crushed",
      "garlic cloves thinly sliced",
      "garlic cloves, finely chopped",
    ]);
  });

  it("files a legacy mint under a food inside its words, with a suggestion to confirm", async () => {
    const legacy = await legacyMint("garlic cloves crushed");

    await expect(recheckUndecidedMintsOnRungChange()).resolves.toEqual({ merged: 0, filed: 1 });
    expect(await shown(legacy)).toMatchObject({
      flagged: true,
      parent: { id: seeded.get("en:garlic") },
    });
    expect(await listIngredientSuggestions()).toMatchObject([
      { ingredientId: legacy, kind: "parent", source: "words" },
    ]);
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
