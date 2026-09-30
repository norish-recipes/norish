// @vitest-environment node
/**
 * Merging Ingredients and moving an alias back out, against a real database:
 * what a household taught Norish about either food survives the merge, the
 * lines behind a spelling follow it wherever it goes, and a wrong merge is
 * one move to undo. The edit policy's matrix is pinned at the procedures.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { withTransaction } from "@norish/db/drizzle";
import {
  fileIngredient,
  listAisleLinksByStoreIds,
  saveStoreAisles,
} from "@norish/db/repositories/aisles";
import { renameCatalogueIngredient } from "@norish/db/repositories/ingredient-catalogue";
import { listPantryIngredientsByUserIds } from "@norish/db/repositories/pantry";
import { resolveProductLink, upsertProductLink } from "@norish/db/repositories/store-products";
import {
  createStore,
  getIngredientStorePreference,
  upsertIngredientStorePreference,
} from "@norish/db/repositories/stores";
import { groceries, householdUsers, ingredients, recurringGroceries } from "@norish/db/schema";
import {
  addAlias,
  CatalogueEditError,
  markDistinct,
  mergeIngredients,
  moveAlias,
} from "@norish/shared-server/ingredients/catalogue";
import { resolveGroceryNames } from "@norish/shared-server/ingredients/groceries";
import { addToPantry } from "@norish/shared-server/ingredients/pantry";
import { ingredientFor, resolveIngredients } from "@norish/shared-server/ingredients/resolver";

import {
  createTestHousehold,
  createTestUser,
  getTestDb,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const GROENTE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ZUIVEL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("merging Ingredients and moving aliases", () => {
  const testBase = new RepositoryTestBase("test_ingredient_merge");

  let actor: CatalogueActor;
  let storeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = { userId: user.id, householdUserIds: null, isServerAdmin: false };
    storeId = (await createStore(crypto.randomUUID(), { userId: user.id, name: "Markt" })).id;
    await saveStoreAisles(storeId, [
      { id: GROENTE, name: "Groente", version: 0 },
      { id: ZUIVEL, name: "Zuivel", version: 0 },
    ]);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function mint(text: string) {
    const [resolved] = await resolveIngredients([text], { userId: actor.userId });

    return resolved!;
  }

  async function typed(name: string) {
    const [resolved] = await resolveGroceryNames([{ name }], { userId: actor.userId });

    return resolved!;
  }

  async function aisleOf(ingredientId: string) {
    const links = await listAisleLinksByStoreIds([storeId]);

    return links.find((link) => link.ingredientId === ingredientId)?.aisleId ?? null;
  }

  async function groceryTyped(name: string) {
    const resolved = await typed(name);
    const [row] = await getTestDb()
      .insert(groceries)
      .values({
        userId: actor.userId,
        name,
        ingredientAliasId: resolved.aliasId,
        ingredientId: resolved.ingredientId,
      })
      .returning({ id: groceries.id });

    return row!.id;
  }

  async function groceryFood(id: string) {
    const [row] = await getTestDb()
      .select({ ingredientId: groceries.ingredientId })
      .from(groceries)
      .where(eq(groceries.id, id));

    return row?.ingredientId ?? null;
  }

  function refusal(promise: Promise<unknown>) {
    return promise.then(
      () => null,
      (error: unknown) => (error instanceof CatalogueEditError ? error.refusal : error)
    );
  }

  describe("merge", () => {
    it("files a grocery typed 'uien' in the onion Aisle once 'uien' is merged into onion", async () => {
      const onion = await mint("onion");
      const uien = await mint("uien");

      await fileIngredient(storeId, onion.ingredientId, GROENTE);
      await mergeIngredients(actor, uien.ingredientId, onion.ingredientId);

      const grocery = await typed("Uien");

      expect(grocery.ingredientId).toBe(onion.ingredientId);
      await expect(aisleOf(grocery.ingredientId)).resolves.toBe(GROENTE);
    });

    it("makes every line behind the source's spellings mean the target", async () => {
      const onion = await mint("onion");
      const uien = await mint("uien");
      const grocery = await groceryTyped("uien");
      const [recurring] = await getTestDb()
        .insert(recurringGroceries)
        .values({
          userId: actor.userId,
          name: "uien",
          ingredientAliasId: uien.aliasId,
          ingredientId: uien.ingredientId,
          recurrenceRule: "week",
          recurrenceInterval: 1,
          nextPlannedFor: "2026-10-01",
        })
        .returning({ id: recurringGroceries.id });

      await mergeIngredients(actor, uien.ingredientId, onion.ingredientId);

      await expect(groceryFood(grocery)).resolves.toBe(onion.ingredientId);
      await expect(ingredientFor(uien.aliasId)).resolves.toMatchObject({
        id: onion.ingredientId,
      });

      const [recurringRow] = await getTestDb()
        .select({ ingredientId: recurringGroceries.ingredientId })
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring!.id));

      expect(recurringRow?.ingredientId).toBe(onion.ingredientId);
    });

    it("carries the source's Aisle, Product Link and store preference to a target without them", async () => {
      const onion = await mint("onion");
      const uien = await mint("uien");

      await fileIngredient(storeId, uien.ingredientId, GROENTE);
      await upsertProductLink(storeId, uien.ingredientId, null);
      await upsertIngredientStorePreference(actor.userId, uien.ingredientId, storeId);

      await mergeIngredients(actor, uien.ingredientId, onion.ingredientId);

      await expect(aisleOf(onion.ingredientId)).resolves.toBe(GROENTE);
      await expect(resolveProductLink(storeId, onion.ingredientId)).resolves.not.toBeNull();
      await expect(
        getIngredientStorePreference(actor.userId, onion.ingredientId)
      ).resolves.toMatchObject({ storeId });
    });

    it("keeps the target's Aisle and store preference where both have one", async () => {
      const onion = await mint("onion");
      const uien = await mint("uien");
      const other = (
        await createStore(crypto.randomUUID(), { userId: actor.userId, name: "Ander" })
      ).id;

      await fileIngredient(storeId, onion.ingredientId, GROENTE);
      await fileIngredient(storeId, uien.ingredientId, ZUIVEL);
      await upsertIngredientStorePreference(actor.userId, onion.ingredientId, storeId);
      await upsertIngredientStorePreference(actor.userId, uien.ingredientId, other);

      await mergeIngredients(actor, uien.ingredientId, onion.ingredientId);

      await expect(aisleOf(onion.ingredientId)).resolves.toBe(GROENTE);
      await expect(
        getIngredientStorePreference(actor.userId, onion.ingredientId)
      ).resolves.toMatchObject({ storeId });
    });

    it("keeps one Pantry Ingredient where a member held both foods", async () => {
      const onion = await mint("onion");
      const uien = await mint("uien");
      const userIds = [actor.userId];

      await addToPantry(crypto.randomUUID(), { userId: actor.userId, userIds, name: "onion" });
      await addToPantry(crypto.randomUUID(), { userId: actor.userId, userIds, name: "uien" });

      await mergeIngredients(actor, uien.ingredientId, onion.ingredientId);

      const pantry = await listPantryIngredientsByUserIds(userIds);

      expect(pantry.map((item) => item.ingredientId)).toEqual([onion.ingredientId]);
    });

    it("keeps one Pantry Ingredient where two members of a household held the two foods", async () => {
      const onion = await mint("onion");
      const uien = await mint("uien");
      const housemate = await createTestUser();
      const household = await createTestHousehold(actor.userId, { id: crypto.randomUUID() });

      await getTestDb()
        .insert(householdUsers)
        .values([
          { householdId: household!.id, userId: actor.userId },
          { householdId: household!.id, userId: housemate.id },
        ]);
      const userIds = [actor.userId, housemate.id];

      await addToPantry(crypto.randomUUID(), { userId: actor.userId, userIds, name: "onion" });
      await addToPantry(crypto.randomUUID(), { userId: housemate.id, userIds, name: "uien" });

      await mergeIngredients(actor, uien.ingredientId, onion.ingredientId);

      const pantry = await listPantryIngredientsByUserIds(userIds);

      expect(pantry.map((item) => item.ingredientId)).toEqual([onion.ingredientId]);
    });

    it("clears the target's flag: a person merged into it on purpose", async () => {
      const knaks = await mint("Unox Knaks");
      const frankfurter = await mint("frankfurter");

      await expect(ingredientFor(knaks.aliasId)).resolves.toMatchObject({ flagged: true });
      await mergeIngredients(actor, frankfurter.ingredientId, knaks.ingredientId);

      await expect(ingredientFor(knaks.aliasId)).resolves.toMatchObject({
        flagged: false,
        flagReason: null,
      });
    });

    it("keeps the seed's id when a seeded food is merged into one without", async () => {
      const knaks = await mint("Unox Knaks");
      const frankfurter = await mint("frankfurter");

      await getTestDb()
        .update(ingredients)
        .set({ offId: "en:frankfurter" })
        .where(eq(ingredients.id, frankfurter.ingredientId));
      await mergeIngredients(actor, frankfurter.ingredientId, knaks.ingredientId);

      const [row] = await getTestDb()
        .select({ offId: ingredients.offId })
        .from(ingredients)
        .where(eq(ingredients.id, knaks.ingredientId));

      expect(row?.offId).toBe("en:frankfurter");
    });

    it("refuses to merge an Ingredient into itself", async () => {
      const onion = await mint("onion");

      await expect(
        refusal(mergeIngredients(actor, onion.ingredientId, onion.ingredientId))
      ).resolves.toBe("same-ingredient");
    });

    it("refuses a merge unless the member may edit both Ingredients", async () => {
      const mine = await mint("onion");
      const stranger = await createTestUser();
      const [theirs] = await resolveIngredients(["uien"], { userId: stranger.id });

      await expect(
        refusal(mergeIngredients(actor, theirs!.ingredientId, mine.ingredientId))
      ).resolves.toBe("forbidden");
      await expect(
        refusal(mergeIngredients(actor, mine.ingredientId, theirs!.ingredientId))
      ).resolves.toBe("forbidden");
      await expect(ingredientFor(theirs!.aliasId)).resolves.toMatchObject({
        id: theirs!.ingredientId,
      });
    });
  });

  describe("moving an alias", () => {
    it("undoes a wrong merge: moved back out, 'uien' is its own food again", async () => {
      const onion = await mint("onion");
      const uien = await mint("uien");
      const grocery = await groceryTyped("uien");

      await fileIngredient(storeId, onion.ingredientId, GROENTE);
      await mergeIngredients(actor, uien.ingredientId, onion.ingredientId);

      const moved = await moveAlias(actor, uien.aliasId, null);

      expect(moved.ingredientId).not.toBe(onion.ingredientId);
      await expect(typed("uien")).resolves.toMatchObject({ ingredientId: moved.ingredientId });
      await expect(groceryFood(grocery)).resolves.toBe(moved.ingredientId);
      await expect(aisleOf(moved.ingredientId)).resolves.toBeNull();
      await expect(typed("onion")).resolves.toMatchObject({ ingredientId: onion.ingredientId });
    });

    it("moves a spelling onto another known Ingredient", async () => {
      const onion = await mint("onion");
      const garlic = await mint("garlic");

      await addAlias(actor, garlic.ingredientId, "ui");
      const [ui] = await resolveIngredients(["ui"], { userId: actor.userId });

      await moveAlias(actor, ui!.aliasId, onion.ingredientId);

      await expect(typed("ui")).resolves.toMatchObject({ ingredientId: onion.ingredientId });
      await expect(typed("garlic")).resolves.toMatchObject({ ingredientId: garlic.ingredientId });
    });

    it("leaves the flag of the Ingredient a spelling moves out of alone", async () => {
      const onion = await mint("onion");

      await addAlias(actor, onion.ingredientId, "ui");
      const [ui] = await resolveIngredients(["ui"], { userId: actor.userId });

      await moveAlias(actor, ui!.aliasId, null);

      await expect(ingredientFor(onion.aliasId)).resolves.toMatchObject({ flagged: true });
    });

    it("mints the new Ingredient unflagged: a person chose it", async () => {
      const onion = await mint("onion");

      await markDistinct(actor, onion.ingredientId);
      await addAlias(actor, onion.ingredientId, "ui");
      const [ui] = await resolveIngredients(["ui"], { userId: actor.userId });

      const moved = await moveAlias(actor, ui!.aliasId, null);

      await expect(ingredientFor(ui!.aliasId)).resolves.toMatchObject({
        id: moved.ingredientId,
        name: "ui",
        flagged: false,
        ownerId: actor.userId,
      });
    });

    it("keeps one Pantry Ingredient where the spelling lands on a food the member holds", async () => {
      const onion = await mint("onion");
      const garlic = await mint("garlic");
      const userIds = [actor.userId];

      await addAlias(actor, garlic.ingredientId, "ui");
      await addToPantry(crypto.randomUUID(), { userId: actor.userId, userIds, name: "onion" });
      await addToPantry(crypto.randomUUID(), { userId: actor.userId, userIds, name: "ui" });
      const [ui] = await resolveIngredients(["ui"], { userId: actor.userId });

      await moveAlias(actor, ui!.aliasId, onion.ingredientId);

      const pantry = await listPantryIngredientsByUserIds(userIds);

      expect(pantry.map((item) => item.ingredientId)).toEqual([onion.ingredientId]);
    });

    it("never moves an Ingredient's last spelling away", async () => {
      const onion = await mint("onion");
      const saffron = await mint("saffron");

      await expect(refusal(moveAlias(actor, saffron.aliasId, onion.ingredientId))).resolves.toBe(
        "last-alias"
      );
    });

    it("refuses a new Ingredient named like one that exists", async () => {
      const onion = await mint("onion");
      const prei = await mint("prei");

      // The name alone, as the upgrade can leave one: a spelling no alias holds.
      await withTransaction((tx) => renameCatalogueIngredient(tx, prei.ingredientId, "Leek"));
      await addAlias(actor, onion.ingredientId, "leek");
      const [leek] = await resolveIngredients(["leek"], { userId: actor.userId });

      await expect(refusal(moveAlias(actor, leek!.aliasId, null))).resolves.toBe("name-taken");
      await expect(typed("leek")).resolves.toMatchObject({ ingredientId: onion.ingredientId });
    });

    it("refuses a member who may not edit the spelling", async () => {
      const stranger = await createTestUser();
      const [theirs] = await resolveIngredients(["uien"], { userId: stranger.id });

      await addAlias(
        { userId: stranger.id, householdUserIds: null, isServerAdmin: false },
        theirs!.ingredientId,
        "ajuin"
      );
      const [ajuin] = await resolveIngredients(["ajuin"], { userId: stranger.id });

      await expect(refusal(moveAlias(actor, ajuin!.aliasId, null))).resolves.toBe("forbidden");
    });
  });
});
