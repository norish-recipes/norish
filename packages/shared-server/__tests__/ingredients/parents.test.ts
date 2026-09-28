// @vitest-environment node
/**
 * Parent Ingredients against a real database: a kind of a food is placed
 * under it, the Pantry covers along the tree in one direction only, a Product
 * Link never follows the tree, and the tree never closes a cycle. The Aisle
 * fallback is read on the client, from the ancestors asked for here.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { findIngredientAncestors } from "@norish/db/repositories/ingredient-catalogue";
import { listPantryIngredientsByUserIds } from "@norish/db/repositories/pantry";
import { resolveProductLink, upsertProductLink } from "@norish/db/repositories/store-products";
import { createStore } from "@norish/db/repositories/stores";
import {
  CatalogueEditError,
  listIngredients,
  mergeIngredients,
  setParent,
} from "@norish/shared-server/ingredients/catalogue";
import { addToPantry } from "@norish/shared-server/ingredients/pantry";
import { ingredientFor, resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

describe("Parent Ingredients", () => {
  const testBase = new RepositoryTestBase("test_parent_ingredients");

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

  /** "red onion" under "onion" under "allium". */
  async function onionTree() {
    const allium = await mint("allium");
    const onion = await mint("onion");
    const red = await mint("red onion");

    await setParent(actor, onion.ingredientId, allium.ingredientId);
    await setParent(actor, red.ingredientId, onion.ingredientId);

    return { allium, onion, red };
  }

  async function pantryCovers(pantryName: string, line: { ingredientId: string }) {
    const userIds = [actor.userId];

    await addToPantry(crypto.randomUUID(), { userId: actor.userId, userIds, name: pantryName });

    return pantryIngredientFor(await listPantryIngredientsByUserIds(userIds), line) !== null;
  }

  it("answers every ancestor of an Ingredient, nearest first", async () => {
    const { allium, onion, red } = await onionTree();

    const ancestors = await findIngredientAncestors([red.ingredientId, allium.ingredientId]);

    expect(ancestors.get(red.ingredientId)).toEqual([onion.ingredientId, allium.ingredientId]);
    expect(ancestors.get(allium.ingredientId)).toEqual([]);
  });

  it("lets red onion in the Pantry cover a line for onion, and for allium above it", async () => {
    const { allium, onion } = await onionTree();

    await expect(pantryCovers("red onion", onion)).resolves.toBe(true);
    await expect(
      pantryIngredientFor(await listPantryIngredientsByUserIds([actor.userId]), allium)
    ).not.toBeNull();
  });

  it("never lets onion in the Pantry cover a line for red onion", async () => {
    const { red } = await onionTree();

    await expect(pantryCovers("onion", red)).resolves.toBe(false);
  });

  it("never lends a parent's Product Link to a child", async () => {
    const { onion, red } = await onionTree();
    const store = await createStore(crypto.randomUUID(), { userId: actor.userId, name: "Markt" });

    await upsertProductLink(store.id, onion.ingredientId, null);

    await expect(resolveProductLink(store.id, onion.ingredientId)).resolves.not.toBeNull();
    await expect(resolveProductLink(store.id, red.ingredientId)).resolves.toBeNull();
  });

  it("refuses a parent that would close a cycle", async () => {
    const { allium, red } = await onionTree();

    await expect(refusal(setParent(actor, allium.ingredientId, red.ingredientId))).resolves.toBe(
      "cycle"
    );
    await expect(refusal(setParent(actor, red.ingredientId, red.ingredientId))).resolves.toBe(
      "cycle"
    );
  });

  it("clears the flag of an Ingredient given a parent, and shows the parent on the page", async () => {
    const onion = await mint("onion");
    const red = await mint("red onion");

    await setParent(actor, red.ingredientId, onion.ingredientId);

    await expect(ingredientFor(red.aliasId)).resolves.toMatchObject({ flagged: false });
    const page = await listIngredients(actor, { search: "red onion" });

    expect(page.items[0]?.parent).toEqual({ id: onion.ingredientId, name: "onion" });
  });

  it("clears a parent", async () => {
    const { red } = await onionTree();

    await setParent(actor, red.ingredientId, null);

    await expect(findIngredientAncestors([red.ingredientId])).resolves.toEqual(
      new Map([[red.ingredientId, []]])
    );
  });

  it("keeps the tree when a food is merged: its children join the target", async () => {
    const { onion, red } = await onionTree();
    const ui = await mint("ui");

    await mergeIngredients(actor, onion.ingredientId, ui.ingredientId);

    const ancestors = await findIngredientAncestors([red.ingredientId]);

    expect(ancestors.get(red.ingredientId)?.[0]).toBe(ui.ingredientId);
  });

  it("moves a target that sat under the source up to its place, so no cycle forms", async () => {
    const { allium, onion, red } = await onionTree();

    await mergeIngredients(actor, onion.ingredientId, red.ingredientId);

    const ancestors = await findIngredientAncestors([red.ingredientId]);

    expect(ancestors.get(red.ingredientId)).toEqual([allium.ingredientId]);
  });
});
