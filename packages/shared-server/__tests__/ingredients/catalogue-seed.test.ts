// @vitest-environment node
/**
 * The ingredient catalogue seed against a real database: a new instance knows
 * that "ui" is "onion", a refresh never undoes what a household taught
 * Norish, an entry the file drops is kept while anything uses it, and a file
 * that is not a taxonomy applies nothing. Fetching is faked at `fetch`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { findIngredientAncestors } from "@norish/db/repositories/ingredient-catalogue";
import { groceries, ingredients, serverConfig } from "@norish/db/schema";
import { addAlias, mergeIngredients, setParent } from "@norish/shared-server/ingredients/catalogue";
import { ingredientFor, resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { buildCatalogueExport } from "@norish/shared-server/ingredients/seed/catalogue-export";
import {
  applySeedFile,
  refreshIngredientCatalogue,
} from "@norish/shared-server/ingredients/seed/catalogue-seed";

import { getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const excerpt = readFileSync(join(__dirname, "fixtures", "ingredients-taxonomy.txt"), "utf8");

/** The excerpt without one entry, as a later version of the file might be. */
function without(entryFirstLine: string, file = excerpt): string {
  return file
    .split(/\n\s*\n/)
    .filter((block) => !block.split("\n").some((line) => line === entryFirstLine))
    .join("\n\n");
}

describe("the ingredient catalogue seed", () => {
  const testBase = new RepositoryTestBase("test_ingredient_seed");

  let actor: CatalogueActor;
  let admin: CatalogueActor;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = { userId: user.id, householdUserIds: null, isServerAdmin: false };
    admin = { ...actor, isServerAdmin: true };
    // The seed's state is instance configuration, which the clean-up keeps.
    await getTestDb()
      .delete(serverConfig)
      .where(eq(serverConfig.key, ServerConfigKeys.INGREDIENT_SEED_STATE));
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function resolve(text: string) {
    const [resolved] = await resolveIngredients([text], { userId: actor.userId }, { ai: false });

    return resolved!;
  }

  async function ingredientNamed(name: string) {
    const [row] = await getTestDb()
      .select({ id: ingredients.id, offId: ingredients.offId, ownerId: ingredients.ownerId })
      .from(ingredients)
      .where(eq(ingredients.name, name));

    return row ?? null;
  }

  describe("applying a file", () => {
    it("knows every spelling of a food in every language", async () => {
      await applySeedFile(excerpt);

      const onion = await resolve("onion");

      await expect(resolve("Uien")).resolves.toMatchObject({ ingredientId: onion.ingredientId });
      await expect(resolve("oignons")).resolves.toMatchObject({
        ingredientId: onion.ingredientId,
      });
      await expect(ingredientFor(onion.aliasId)).resolves.toMatchObject({
        name: "onion",
        ownerId: null,
        flagged: false,
      });
    });

    it("places each food under the first food it is a kind of", async () => {
      await applySeedFile(excerpt);

      const red = await resolve("rode ui");
      const onion = await resolve("onion");
      const family = await resolve("onion-family vegetable");
      const vegetable = await resolve("groente");

      await expect(findIngredientAncestors([red.ingredientId])).resolves.toEqual(
        new Map([
          [red.ingredientId, [onion.ingredientId, family.ingredientId, vegetable.ingredientId]],
        ])
      );
    });

    it("changes nothing when the same file is applied again", async () => {
      await applySeedFile(excerpt);
      const { outcome } = await applySeedFile(excerpt);

      expect(outcome).toMatchObject({ created: 0, adopted: 0, aliasesAdded: 0, parentsSet: 0 });
    });

    it("takes an existing Ingredient of the same name as the entry, and keeps its owner", async () => {
      const mine = await resolve("Onion");

      await applySeedFile(excerpt);

      await expect(resolve("ui")).resolves.toMatchObject({ ingredientId: mine.ingredientId });
      await expect(ingredientNamed("Onion")).resolves.toMatchObject({
        offId: "en:onion",
        ownerId: actor.userId,
      });
    });

    it("leaves a spelling another Ingredient holds where it is, and reports it", async () => {
      const zeezout = await resolve("zeezout");
      const { outcome } = await applySeedFile(excerpt);

      expect(outcome.aliasCollisions).toContainEqual({ fold: "zeezout", offId: "en:salt,-sea" });
      await expect(resolve("zeezout")).resolves.toMatchObject({
        ingredientId: zeezout.ingredientId,
      });
    });

    it("applies nothing from a file that is not a taxonomy", async () => {
      await expect(applySeedFile("<!DOCTYPE html><p>Too many requests</p>")).rejects.toThrow();

      await expect(ingredientNamed("onion")).resolves.toBeNull();
    });
  });

  describe("a refresh never undoes what a household taught Norish", () => {
    it("keeps a spelling a person added to a seeded food", async () => {
      await applySeedFile(excerpt);
      const onion = await resolve("onion");

      await addAlias(actor, onion.ingredientId, "uitje");
      await applySeedFile(excerpt);

      await expect(resolve("uitje")).resolves.toMatchObject({ ingredientId: onion.ingredientId });
    });

    it("keeps a merge: the merged entry is not minted again", async () => {
      await applySeedFile(excerpt);
      const onion = await resolve("onion");
      const red = await resolve("red onion");

      await mergeIngredients(admin, red.ingredientId, onion.ingredientId);
      const { outcome } = await applySeedFile(excerpt);

      expect(outcome.created).toBe(0);
      await expect(resolve("rode uien")).resolves.toMatchObject({
        ingredientId: onion.ingredientId,
      });
      await expect(ingredientNamed("red onion")).resolves.toBeNull();
    });

    it("keeps a parent a person set, and a parent a person cleared", async () => {
      await applySeedFile(excerpt);
      const red = await resolve("red onion");
      const vegetable = await resolve("vegetable");
      const onion = await resolve("onion");

      await setParent(admin, red.ingredientId, vegetable.ingredientId);
      await setParent(admin, onion.ingredientId, null);
      await applySeedFile(excerpt);

      const ancestors = await findIngredientAncestors([red.ingredientId, onion.ingredientId]);

      expect(ancestors.get(red.ingredientId)).toEqual([vegetable.ingredientId]);
      expect(ancestors.get(onion.ingredientId)).toEqual([]);
    });
  });

  describe("an entry the file no longer lists", () => {
    it("is kept while a grocery uses it, and removed when nothing does", async () => {
      await applySeedFile(excerpt);
      const imazalil = await resolve("imazalil");

      await getTestDb().insert(groceries).values({
        userId: actor.userId,
        name: "imazalil",
        ingredientAliasId: imazalil.aliasId,
        ingredientId: imazalil.ingredientId,
      });

      const { outcome } = await applySeedFile(without("en: salt\\, sea", without("en: imazalil")));

      expect(outcome.removed).toBe(1);
      await expect(ingredientNamed("imazalil")).resolves.not.toBeNull();
      await expect(ingredientNamed("salt, sea")).resolves.toBeNull();
    });
  });

  describe("the nightly refresh", () => {
    function serving(file: string, etag: string) {
      const asked: Array<Record<string, string>> = [];
      const fetchImpl = (async (_url: string, init?: RequestInit) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;

        asked.push(headers);
        if (headers["If-None-Match"] === etag) return new Response(null, { status: 304 });

        return new Response(file, { status: 200, headers: { etag } });
      }) as typeof fetch;

      return { fetchImpl, asked };
    }

    it("merges an existing Ingredient the seed knows into its entry, once", async () => {
      const onions = await resolve("onions");
      const sjalot = serving(excerpt, '"v1"');

      await expect(refreshIngredientCatalogue(sjalot.fetchImpl)).resolves.toBe("applied");

      const onion = await resolve("onion");

      expect(onion.ingredientId).not.toBe(onions.ingredientId);
      // Merged: the old spelling now names the seeded food.
      await expect(ingredientFor(onions.aliasId)).resolves.toMatchObject({
        id: onion.ingredientId,
      });

      // A later name the seed claims is left to a person: the pass ran once.
      const shallot = await resolve("sjalot");
      const next = serving(`${excerpt}\n\nen: shallot\nnl: sjalot\n`, '"v2"');

      await refreshIngredientCatalogue(next.fetchImpl);

      await expect(resolve("sjalot")).resolves.toMatchObject({
        ingredientId: shallot.ingredientId,
      });
    });

    it("asks only for a newer file, and applies nothing when there is none", async () => {
      const server = serving(excerpt, '"v1"');

      await refreshIngredientCatalogue(server.fetchImpl);
      await expect(refreshIngredientCatalogue(server.fetchImpl)).resolves.toBe("unchanged");

      expect(server.asked[1]).toMatchObject({ "If-None-Match": '"v1"' });
    });

    it("keeps the last good seed when the fetch fails", async () => {
      await refreshIngredientCatalogue(serving(excerpt, '"v1"').fetchImpl);
      const failing = (async () => new Response("down", { status: 503 })) as typeof fetch;

      await expect(refreshIngredientCatalogue(failing)).rejects.toThrow("HTTP 503");
      await expect(resolve("ui")).resolves.toMatchObject({
        ingredientId: (await resolve("onion")).ingredientId,
      });
    });
  });

  describe("the export", () => {
    it("offers every Ingredient with its spellings and parent, credits the source, and names no one", async () => {
      await applySeedFile(excerpt);
      const mine = await resolve("tuinkers");
      const catalogue = await buildCatalogueExport(new Date("2026-09-28T00:00:00Z"));
      const onion = catalogue.ingredients.find((ingredient) => ingredient.name === "onion")!;
      const family = catalogue.ingredients.find(
        (ingredient) => ingredient.name === "onion-family vegetable"
      )!;

      expect(catalogue.source.licence).toContain("ODbL");
      expect(onion).toMatchObject({ openFoodFactsId: "en:onion", parentId: family.id });
      expect(onion.aliases).toContainEqual({ text: "ui", locale: "nl" });
      expect(
        catalogue.ingredients.find((ingredient) => ingredient.id === mine.ingredientId)
      ).toMatchObject({ openFoodFactsId: null });
      expect(JSON.stringify(catalogue)).not.toContain(actor.userId);
    });
  });
});
