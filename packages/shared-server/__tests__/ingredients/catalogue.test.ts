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
  deleteIngredient,
  listIngredients,
  listSpellings,
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

  it("makes a new name one of the Ingredient's spellings", async () => {
    const onion = await mint("onion");

    await renameIngredient(actor, onion.ingredientId, "Yellow onion");

    const [again] = await resolveIngredients(["yellow onion"], { userId: actor.userId });

    expect(again!.ingredientId).toBe(onion.ingredientId);
  });

  it("deletes an Ingredient nothing uses, its spellings with it", async () => {
    const saffron = await mint("saffron");

    await addAlias(actor, saffron.ingredientId, "zafraan");
    await deleteIngredient(actor, saffron.ingredientId);

    await expect(ingredientFor(saffron.aliasId)).resolves.toBeNull();

    const [again] = await resolveIngredients(["zafraan"], { userId: actor.userId });

    // Minted afresh: the spelling went with the food.
    expect(again!.ingredientId).not.toBe(saffron.ingredientId);
    await expect(refusal(deleteIngredient(actor, saffron.ingredientId))).resolves.toBe("not-found");
  });

  it("keeps an Ingredient a grocery still points at, for a merge to give it another food", async () => {
    const onion = await mint("onion");

    await getTestDb().insert(groceries).values({
      userId: actor.userId,
      name: "onion",
      ingredientAliasId: onion.aliasId,
      ingredientId: onion.ingredientId,
    });

    await expect(refusal(deleteIngredient(actor, onion.ingredientId))).resolves.toBe(
      "ingredient-in-use"
    );
    await expect(ingredientFor(onion.aliasId)).resolves.toMatchObject({ name: "onion" });
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

  it("says why a food is flagged, and sends the viewer's spellings with the rest on request", async () => {
    const cream = await mint("cream");

    await addAlias(actor, cream.ingredientId, "room");

    const page = await listIngredients(actor, { search: "cream", locale: "nl" });

    // Minted without AI in these tests: that is the reason.
    expect(page.items[0]).toMatchObject({
      flagged: true,
      flagReason: "ai-off",
      hiddenSpellings: 0,
    });
    expect(page.items[0]!.aliases.map((alias) => alias.text)).toEqual(["cream", "room"]);
    expect((await listSpellings(actor, cream.ingredientId)).map((alias) => alias.text)).toEqual([
      "cream",
      "room",
    ]);

    await markDistinct(actor, cream.ingredientId);
    expect((await listIngredients(actor, { search: "cream" })).items[0]).toMatchObject({
      flagged: false,
      flagReason: null,
    });
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

  it("reads a search as a word start, a pattern with %, or exactly <this>, the flagged first", async () => {
    const cola = await mint("cola");
    const chocolate = await mint("chocolate");
    const nut = await mint("cola nut");

    await markDistinct(actor, cola.ingredientId);
    await markDistinct(actor, chocolate.ingredientId);
    await addAlias(actor, chocolate.ingredientId, "chocola");

    const names = async (search: string) =>
      (await listIngredients(actor, { search })).items.map((item) => item.name);

    // A word start: never "chocolate". The exact name first, then the flagged one.
    await expect(names("cola")).resolves.toEqual(["cola", "cola nut"]);
    // Anything containing it, its own spellings included.
    await expect(names("%cola%")).resolves.toEqual(["cola", "cola nut", "chocolate"]);
    await expect(names("%cola")).resolves.toEqual(["cola", "chocolate"]);
    await expect(names("cola%")).resolves.toEqual(["cola", "cola nut"]);
    // Exactly this.
    await expect(names("<Cola>")).resolves.toEqual(["cola"]);
    // Without a search, the flagged lead.
    expect((await listIngredients(actor, {})).items[0]!.id).toBe(nut.ingredientId);
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
