// @vitest-environment node
/**
 * The catalogue as the Ingredients page edits it, against a real database:
 * looking after a Flagged Ingredient clears its flag, a household's own word
 * joins the food it names, and nothing an edit does can leave a recipe line
 * or a grocery without its food. The edit policy's matrix is pinned at the
 * procedures; here the editor is the Ingredient's owner.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { renameCatalogueIngredient } from "@norish/db/repositories/ingredient-catalogue";
import { groceries } from "@norish/db/schema";
import {
  addAlias,
  CatalogueEditError,
  listIngredients,
  markDistinct,
  removeAlias,
  renameIngredient,
} from "@norish/shared-server/ingredients/catalogue";
import { resolveGroceryNames } from "@norish/shared-server/ingredients/groceries";
import { ingredientFor, resolveIngredients } from "@norish/shared-server/ingredients/resolver";

import { createTestUser, getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

describe("the ingredient catalogue", () => {
  const testBase = new RepositoryTestBase("test_ingredient_catalogue");

  let actor: CatalogueActor;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = { userId: user.id, householdUserIds: null, isServerAdmin: false };
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function mint(text: string) {
    const [resolved] = await resolveIngredients([text], { userId: actor.userId });

    return resolved!;
  }

  function refusal(promise: Promise<unknown>) {
    return promise.then(
      () => null,
      (error: unknown) => (error instanceof CatalogueEditError ? error.refusal : error)
    );
  }

  it("clears the flag of an Ingredient a person renames", async () => {
    const onion = await mint("onion");

    await renameIngredient(actor, onion.ingredientId, "Onion");

    await expect(ingredientFor(onion.aliasId)).resolves.toMatchObject({
      name: "Onion",
      flagged: false,
    });
  });

  it("clears the flag of an Ingredient marked distinct, and leaves its name", async () => {
    const powder = await mint("onion powder");

    await markDistinct(actor, powder.ingredientId);

    await expect(ingredientFor(powder.aliasId)).resolves.toMatchObject({
      name: "onion powder",
      flagged: false,
    });
  });

  it("refuses a name another Ingredient goes by, in any case", async () => {
    await mint("garlic");
    const leek = await mint("leek");

    await expect(refusal(renameIngredient(actor, leek.ingredientId, "Garlic"))).resolves.toBe(
      "name-taken"
    );
  });

  it("answers a rename that loses the race for a name as taken, not as a failure", async () => {
    const garlic = await mint("garlic");
    const leek = await mint("leek");

    // The check passed for both; the unique name decides.
    await expect(renameCatalogueIngredient(leek.ingredientId, "Garlic")).resolves.toBe("taken");
    await expect(ingredientFor(garlic.aliasId)).resolves.toMatchObject({ name: "garlic" });
  });

  it("files a household's own word under the food it names", async () => {
    const onion = await mint("onion");

    await addAlias(actor, onion.ingredientId, "Ajuin");

    const [typed] = await resolveGroceryNames([{ name: "ajuin" }], { userId: actor.userId });

    expect(typed?.ingredientId).toBe(onion.ingredientId);
  });

  it("refuses a spelling another food already holds", async () => {
    const onion = await mint("onion");
    await mint("garlic");

    await expect(refusal(addAlias(actor, onion.ingredientId, "Garlic!"))).resolves.toBe(
      "spelling-taken"
    );
  });

  it("removes a spelling nothing points at, and keeps one a grocery points at", async () => {
    const onion = await mint("onion");

    await addAlias(actor, onion.ingredientId, "ajuin");
    await addAlias(actor, onion.ingredientId, "ui");

    const [ui] = await resolveIngredients(["ui"], { userId: actor.userId });
    const [ajuin] = await resolveIngredients(["ajuin"], { userId: actor.userId });

    await getTestDb().insert(groceries).values({
      userId: actor.userId,
      name: "ui",
      ingredientAliasId: ui!.aliasId,
      ingredientId: ui!.ingredientId,
    });

    await expect(refusal(removeAlias(actor, ui!.aliasId))).resolves.toBe("alias-in-use");
    await removeAlias(actor, ajuin!.aliasId);

    const [again] = await resolveIngredients(["ajuin"], { userId: actor.userId });

    // Gone: "ajuin" is a new food again.
    expect(again!.ingredientId).not.toBe(onion.ingredientId);
  });

  it("never removes an Ingredient's last spelling", async () => {
    const saffron = await mint("saffron");

    await expect(refusal(removeAlias(actor, saffron.aliasId))).resolves.toBe("last-alias");
  });

  it("finds an Ingredient by any of its spellings, folded, and lists the flagged ones apart", async () => {
    const creme = await mint("crème fraîche");

    await markDistinct(actor, creme.ingredientId);
    await mint("cream");

    const search = await listIngredients(actor, { search: "CREME" });

    expect(search.items.map((item) => item.name)).toEqual(["crème fraîche"]);
    expect(search.items[0]).toMatchObject({ canEdit: true, flagged: false });

    const flagged = await listIngredients(actor, { flaggedOnly: true });

    expect(flagged.items.map((item) => item.name)).toEqual(["cream"]);
  });

  it("leaves another member's Ingredient alone under the default household policy", async () => {
    const onion = await mint("onion");
    const stranger = await createTestUser();

    await expect(
      refusal(
        renameIngredient(
          { userId: stranger.id, householdUserIds: null, isServerAdmin: false },
          onion.ingredientId,
          "Onions"
        )
      )
    ).resolves.toBe("forbidden");
  });
});
