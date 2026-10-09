// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  fileIngredient,
  getAisleById,
  listAisleLinksByStoreIds,
  listAislesByStoreIds,
} from "@norish/db/repositories/aisles";
import {
  createStore,
  deleteStore,
  getStoreById,
  listStoresByUserIds,
  reorderStores,
  updateStore,
} from "@norish/db/repositories/stores";
import { aisleLinks, aisles, stores } from "@norish/db/schema";

import { resolveIngredients } from "../../../../../shared-server/src/ingredients/resolver";
import { getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const ZUIVEL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BROOD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GROENTE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("aisles and aisle links", () => {
  const testBase = new RepositoryTestBase("test_aisles");

  let userId: string;
  let storeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    // A plain Store, with no shop behind it: aisles need none.
    const store = await createStore(crypto.randomUUID(), { userId, name: "Markt" });

    storeId = store.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const names = (list: { name: string }[]) => list.map((aisle) => aisle.name);

  describe("a Store keeps one aisle list, in order", () => {
    it("is created with no aisles, and reads as such everywhere", async () => {
      await expect(getStoreById(storeId)).resolves.toMatchObject({ aisles: [] });
      const [store] = await listStoresByUserIds([userId]);

      expect(store?.aisles).toEqual([]);
    });

    it("saves the list it is given, in the order it is given", async () => {
      const saved = await updateStore({
        id: storeId,
        aisles: [
          { id: GROENTE, name: "Groente" },
          { id: ZUIVEL, name: "Zuivel" },
          { id: BROOD, name: "Brood" },
        ],
      });

      expect(names(saved!.aisles)).toEqual(["Groente", "Zuivel", "Brood"]);
      expect(saved!.aisles.map((aisle) => aisle.sortOrder)).toEqual([0, 1, 2]);
      expect(saved!.aisles.every((aisle) => aisle.storeId === storeId)).toBe(true);

      // The list comes back with the Store, however the Store is read.
      await expect(getStoreById(storeId)).resolves.toMatchObject({
        aisles: [{ name: "Groente" }, { name: "Zuivel" }, { name: "Brood" }],
      });
      const [listed] = await listStoresByUserIds([userId]);

      expect(names(listed!.aisles)).toEqual(["Groente", "Zuivel", "Brood"]);
    });

    it("renames and repositions a known aisle, creates a new one and deletes the absent", async () => {
      await updateStore({
        id: storeId,
        aisles: [
          { id: ZUIVEL, name: "Zuivel" },
          { id: BROOD, name: "Brood" },
        ],
      });

      const saved = await updateStore({
        id: storeId,
        aisles: [
          { id: GROENTE, name: "Groente & fruit" },
          { id: ZUIVEL, name: "Zuivel en kaas" },
        ],
      });

      expect(saved!.aisles.map((aisle) => [aisle.id, aisle.name, aisle.sortOrder])).toEqual([
        [GROENTE, "Groente & fruit", 0],
        [ZUIVEL, "Zuivel en kaas", 1],
      ]);
      await expect(getAisleById(BROOD)).resolves.toBeNull();
    });

    it("lets two aisles swap names in one save", async () => {
      await updateStore({
        id: storeId,
        aisles: [
          { id: ZUIVEL, name: "Zuivel" },
          { id: BROOD, name: "Brood" },
        ],
      });

      const saved = await updateStore({
        id: storeId,
        aisles: [
          { id: ZUIVEL, name: "Brood" },
          { id: BROOD, name: "Zuivel" },
        ],
      });

      expect(saved!.aisles.map((aisle) => [aisle.id, aisle.name])).toEqual([
        [ZUIVEL, "Brood"],
        [BROOD, "Zuivel"],
      ]);
    });

    it("applies a rename made against the version the aisle has, and drops one made against an older one", async () => {
      const saved = await updateStore({ id: storeId, aisles: [{ id: ZUIVEL, name: "Zuivel" }] });
      const version = saved!.aisles[0]!.version;

      // A housemate renames it first; the rename bumps the version.
      const theirs = await updateStore({
        id: storeId,
        aisles: [{ id: ZUIVEL, name: "Zuivel en kaas", version }],
      });

      expect(theirs!.aisles[0]).toMatchObject({ name: "Zuivel en kaas", version: version + 1 });

      // Ours was made against the version we read, which is no longer the
      // aisle's: the first writer won (ADR-0004), and nothing is parked or
      // half-renamed.
      const ours = await updateStore({
        id: storeId,
        aisles: [{ id: ZUIVEL, name: "Melk en kaas", version }],
      });

      expect(ours!.aisles[0]).toMatchObject({ name: "Zuivel en kaas", version: version + 1 });
    });

    it("bumps an aisle's version only when its name or place changed", async () => {
      const saved = await updateStore({
        id: storeId,
        aisles: [
          { id: ZUIVEL, name: "Zuivel" },
          { id: BROOD, name: "Brood" },
        ],
      });
      const [zuivel, brood] = saved!.aisles;

      const again = await updateStore({
        id: storeId,
        color: "sky",
        aisles: [
          { id: ZUIVEL, name: "Zuivel" },
          { id: BROOD, name: "Brood" },
        ],
      });

      expect(again!.aisles.map((aisle) => aisle.version)).toEqual([
        zuivel!.version,
        brood!.version,
      ]);

      const moved = await updateStore({
        id: storeId,
        aisles: [
          { id: BROOD, name: "Brood" },
          { id: ZUIVEL, name: "Zuivel" },
        ],
      });

      expect(moved!.aisles.map((aisle) => [aisle.id, aisle.version])).toEqual([
        [BROOD, brood!.version + 1],
        [ZUIVEL, zuivel!.version + 1],
      ]);
    });

    it("leaves the aisles alone when an update says nothing about them", async () => {
      await updateStore({ id: storeId, aisles: [{ id: ZUIVEL, name: "Zuivel" }] });

      const renamed = await updateStore({ id: storeId, name: "Boerenmarkt" });

      expect(renamed?.name).toBe("Boerenmarkt");
      expect(names(renamed!.aisles)).toEqual(["Zuivel"]);
    });

    it("is created with its aisles in one go", async () => {
      const store = await createStore(crypto.randomUUID(), {
        userId,
        name: "Dirk",
        aisles: [
          { id: crypto.randomUUID(), name: "Zuivel" },
          { id: crypto.randomUUID(), name: "Brood" },
        ],
      });

      expect(names(store.aisles)).toEqual(["Zuivel", "Brood"]);
      await expect(getStoreById(store.id)).resolves.toMatchObject({
        aisles: [{ name: "Zuivel" }, { name: "Brood" }],
      });
    });

    it("travels with the Store through a reorder", async () => {
      await updateStore({ id: storeId, aisles: [{ id: ZUIVEL, name: "Zuivel" }] });
      const [store] = await getTestDb().select().from(stores).where(eq(stores.id, storeId));

      const [reordered] = await reorderStores([{ id: storeId, version: store!.version }]);

      expect(names(reordered!.aisles)).toEqual(["Zuivel"]);
    });

    it("refuses two aisles whose names differ only in case", async () => {
      await updateStore({ id: storeId, aisles: [{ id: ZUIVEL, name: "Zuivel" }] });

      await expect(
        getTestDb().insert(aisles).values({ storeId, name: "zuivel", sortOrder: 1 })
      ).rejects.toThrow();
    });

    it("never touches another Store's aisle, whatever id it is handed", async () => {
      const other = await createStore(crypto.randomUUID(), {
        userId,
        name: "Jumbo",
        aisles: [{ id: ZUIVEL, name: "Zuivel" }],
      });

      // The same id, sent as this Store's: it is not this Store's to rename.
      await updateStore({ id: storeId, aisles: [{ id: ZUIVEL, name: "Hijacked" }] });

      await expect(getAisleById(ZUIVEL)).resolves.toMatchObject({
        storeId: other.id,
        name: "Zuivel",
      });
      await expect(listAislesByStoreIds([storeId])).resolves.toEqual([]);
    });
  });

  describe("an Aisle Link: where a Store files an Ingredient", () => {
    beforeEach(async () => {
      await updateStore({
        id: storeId,
        aisles: [
          { id: ZUIVEL, name: "Zuivel" },
          { id: BROOD, name: "Brood" },
        ],
      });
    });

    /** The Ingredient a grocery name resolves to, as the filing procedure resolves it. */
    async function ingredient(name: string) {
      const [resolved] = await resolveIngredients([name], { userId });

      return resolved!.ingredientId;
    }

    it("keeps one link per Store and Ingredient, last writer winning, whichever spelling filed it", async () => {
      const melk = await ingredient("Melk");

      await expect(fileIngredient(storeId, melk, ZUIVEL)).resolves.toEqual({
        storeId,
        ingredientId: melk,
        aisleId: ZUIVEL,
      });
      await fileIngredient(storeId, await ingredient("  MELK!  "), BROOD);

      await expect(listAisleLinksByStoreIds([storeId])).resolves.toEqual([
        { storeId, ingredientId: melk, aisleId: BROOD },
      ]);
    });

    it("forgets an Ingredient filed under null, and says so", async () => {
      const melk = await ingredient("melk");

      await fileIngredient(storeId, melk, ZUIVEL);

      await expect(fileIngredient(storeId, melk, null)).resolves.toEqual({
        storeId,
        ingredientId: melk,
        aisleId: null,
      });
      await expect(getTestDb().select().from(aisleLinks)).resolves.toEqual([]);
    });

    it("forgets the links of an aisle that is removed", async () => {
      const brood = await ingredient("brood");

      await fileIngredient(storeId, await ingredient("melk"), ZUIVEL);
      await fileIngredient(storeId, brood, BROOD);

      await updateStore({ id: storeId, aisles: [{ id: BROOD, name: "Brood" }] });

      await expect(listAisleLinksByStoreIds([storeId])).resolves.toEqual([
        { storeId, ingredientId: brood, aisleId: BROOD },
      ]);
    });

    it("reads the links of a household's Stores in one query", async () => {
      const other = await createStore(crypto.randomUUID(), {
        userId,
        name: "Jumbo",
        aisles: [{ id: GROENTE, name: "Groente" }],
      });
      const melk = await ingredient("melk");
      const appels = await ingredient("appels");

      await fileIngredient(storeId, melk, ZUIVEL);
      await fileIngredient(other.id, appels, GROENTE);

      const links = await listAisleLinksByStoreIds([storeId, other.id]);

      expect(links.map((link) => [link.storeId, link.ingredientId, link.aisleId]).sort()).toEqual(
        [
          [other.id, appels, GROENTE],
          [storeId, melk, ZUIVEL],
        ].sort()
      );
      await expect(listAisleLinksByStoreIds([])).resolves.toEqual([]);
    });

    it("goes with the Store, aisles and all", async () => {
      await fileIngredient(storeId, await ingredient("melk"), ZUIVEL);
      const [store] = await getTestDb().select().from(stores).where(eq(stores.id, storeId));

      await deleteStore(storeId, store!.version, false, []);

      await expect(getTestDb().select().from(aisles)).resolves.toEqual([]);
      await expect(getTestDb().select().from(aisleLinks)).resolves.toEqual([]);
    });
  });
});
