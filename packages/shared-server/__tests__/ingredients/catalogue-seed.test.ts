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
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { listAIChanges } from "@norish/db/repositories/ingredient-ai-changes";
import {
  findIngredientByAliasId,
  findRecipeLineAliases,
} from "@norish/db/repositories/ingredient-aliases";
import { listJunkFolds } from "@norish/db/repositories/ingredient-junk-pile";
import { findIngredientAncestors } from "@norish/db/repositories/ingredient-relocation";
import { listPantryIngredientsByUserIds } from "@norish/db/repositories/pantry";
import { groceries, ingredientAliases, ingredients, serverConfig } from "@norish/db/schema";
import { mergeByAI, parentByAI } from "@norish/shared-server/ingredients/ai-changes";
import {
  addAlias,
  listIngredients,
  mergeIngredients,
  moveAlias,
  setParent,
} from "@norish/shared-server/ingredients/catalogue";
import { addToPantry } from "@norish/shared-server/ingredients/pantry";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { buildCatalogueExport } from "@norish/shared-server/ingredients/seed/catalogue-export";
import {
  applySeedEntries,
  readIngredientSeedState,
  refreshIngredientCatalogue,
  SEED_CORRECTIONS_VERSION,
  seedEntriesOf,
  updateIngredientSeedState,
} from "@norish/shared-server/ingredients/seed/catalogue-seed";
import { correctSeedOnce } from "@norish/shared-server/ingredients/seed/correct-seed";
import {
  JUNK_SEED,
  JUNK_SEED_CONCEPTS,
  JUNK_SEED_VERSION,
  seedJunkPileOnce,
} from "@norish/shared-server/ingredients/seed/junk-pile";
import { CATALOGUE_LANGUAGES } from "@norish/shared/lib/ingredient-names";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import {
  getSpellingTexts,
  getTestDb,
  nameInATestRecipe,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const excerpt = readFileSync(join(__dirname, "fixtures", "ingredients-taxonomy.txt"), "utf8");

/** A taxonomy file applied as the refresh applies it, without the fetch. */
const applySeedFile = async (file: string) => await applySeedEntries(seedEntriesOf(file));

/** The excerpt without one entry, as a later version of the file might be. */
function without(entryFirstLine: string, file = excerpt): string {
  return file
    .split(/\n\s*\n/)
    .filter((block) => !block.split("\n").some((line) => line === entryFirstLine))
    .join("\n\n");
}

/** A server for the file that answers 304 to a request for the `etag` it has. */
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
    const [resolved] = await resolveIngredients([text], { userId: actor.userId }, "upgrade");

    return resolved!;
  }

  async function ingredientNamed(name: string) {
    const [row] = await getTestDb()
      .select({
        id: ingredients.id,
        offId: ingredients.offId,
        ownerId: ingredients.ownerId,
        flagged: ingredients.flagged,
      })
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
      await expect(findIngredientByAliasId(onion.aliasId)).resolves.toMatchObject({
        name: "onion",
        ownerId: null,
        flagged: false,
      });
    });

    it("cleans its spellings of stray marks and keeps the brackets that tell foods apart", async () => {
      await applySeedFile(
        `${excerpt}\n\nen: bell pepper\nnl: paprika (vrucht)\n\nen: paprika\nnl: paprika\n\n` +
          `en: honey\nak: 3wu)\n\nen: amaranth\nhi: |चौलाई}}\n`
      );

      const bellPepper = await resolve("bell pepper");
      const honey = await resolve("honey");
      const amaranth = await resolve("amaranth");

      await expect(resolve("paprika (vrucht)")).resolves.toMatchObject({
        ingredientId: bellPepper.ingredientId,
      });
      expect((await resolve("paprika")).ingredientId).not.toBe(bellPepper.ingredientId);
      await expect(getSpellingTexts(bellPepper.ingredientId)).resolves.toContain(
        "paprika (vrucht)"
      );
      await expect(getSpellingTexts(honey.ingredientId)).resolves.toEqual(["3wu", "honey"]);
      await expect(getSpellingTexts(amaranth.ingredientId)).resolves.toEqual(["amaranth", "चौलाई"]);
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

      expect(outcome).toMatchObject({
        created: 0,
        adopted: 0,
        aliasesAdded: 0,
        parentsSet: 0,
        nutritionChanged: 0,
      });
    });

    it("keeps each entry's nutrition codes, and a code changed upstream arrives with the next one", async () => {
      await applySeedFile(excerpt);

      const codesOf = async (name: string) => {
        const [row] = await getTestDb()
          .select({ codes: ingredients.nutritionCodes })
          .from(ingredients)
          .where(eq(ingredients.name, name));

        return row?.codes;
      };

      await expect(codesOf("onion")).resolves.toEqual({
        ciqual: ["20034"],
        usda: ["ndb:11282", "fdc:170000"],
        ciqualOther: [],
        pieceWeight: 150,
        density: null,
      });
      await expect(codesOf("red onion")).resolves.toBeNull();

      const { outcome } = await applySeedFile(
        excerpt.replace("ciqual_food_code:en: 20034", "ciqual_food_code:en: 20035")
      );

      expect(outcome.nutritionChanged).toBe(1);
      await expect(codesOf("onion")).resolves.toMatchObject({ ciqual: ["20035"] });
    });

    it("takes an existing Ingredient of the same name as the entry, and keeps its owner", async () => {
      const mine = await resolve("Onion");

      await applySeedFile(excerpt);

      await expect(resolve("ui")).resolves.toMatchObject({ ingredientId: mine.ingredientId });
      // The seed vouches for it: the entry's name, and no flag.
      await expect(ingredientNamed("onion")).resolves.toMatchObject({
        id: mine.ingredientId,
        offId: "en:onion",
        ownerId: actor.userId,
        flagged: false,
      });
    });

    it("vouches for an adopted Ingredient's unsure AI merges too: no flag, each sure, still to undo", async () => {
      const mine = await resolve("Onion");
      const rings = await resolve("uienringen");

      await nameInATestRecipe(actor.userId, rings.aliasId, "uienringen");
      await mergeByAI(rings.ingredientId, mine.ingredientId, false);
      await applySeedFile(excerpt);

      await expect(findIngredientByAliasId(rings.aliasId)).resolves.toMatchObject({
        id: mine.ingredientId,
        flagged: false,
      });
      expect(await listAIChanges()).toMatchObject([{ sure: true, kept: false }]);
    });

    it("keeps an adopted Ingredient's own name where another Ingredient holds the entry's", async () => {
      const mine = await resolve("onion");

      await getTestDb()
        .update(ingredients)
        .set({ name: "my onion" })
        .where(eq(ingredients.id, mine.ingredientId));
      await getTestDb().insert(ingredients).values({ name: "onion" });
      await applySeedFile(excerpt);

      await expect(ingredientNamed("my onion")).resolves.toMatchObject({
        id: mine.ingredientId,
        offId: "en:onion",
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

  describe("spellings the file gives the wrong food", () => {
    /**
     * Open Food Facts' coating, which holds seasoning's names too, an entry before mixed spices that
     * also lists one, and the mixed spices they belong to.
     */
    const spices =
      `${excerpt}\n\nen: coating, seasoning\nes: sazonador\nfr: enrobage\n\n` +
      `en: herb salt, seasoning\n\nen: mixed spices\nnl: gemengde specerijen\n`;

    function parentOf(ingredientId: string) {
      return findIngredientAncestors([ingredientId]).then(
        (all) => all.get(ingredientId)?.[0] ?? null
      );
    }

    async function seasoningAlias() {
      const [row] = await getTestDb()
        .select({ id: ingredientAliases.id })
        .from(ingredientAliases)
        .where(eq(ingredientAliases.fold, "seasoning"));

      return row!.id;
    }

    it("gives seasoning to mixed spices, every time the file is applied, and files a seasoning there quietly", async () => {
      await applySeedFile(spices);
      await applySeedFile(spices);

      const mixed = await resolve("mixed spices");
      const coating = await resolve("coating");

      await expect(resolve("seasoning")).resolves.toMatchObject({
        ingredientId: mixed.ingredientId,
      });
      await expect(resolve("sazonador")).resolves.toMatchObject({
        ingredientId: mixed.ingredientId,
      });
      await expect(getSpellingTexts(coating.ingredientId)).resolves.toEqual([
        "coating",
        "enrobage",
      ]);
      await expect(parentOf((await resolve("taco seasoning")).ingredientId)).resolves.toBe(
        mixed.ingredientId
      );
      await expect(listAIChanges()).resolves.toEqual([]);
    });

    it("gives jam to the food jam, though yam's Croatian spelling comes first in the file", async () => {
      await applySeedFile(`${excerpt}\n\nen: yam\nhr: jam\n\nen: jam, confiture\n`);

      await expect(resolve("jam")).resolves.toMatchObject({
        ingredientId: (await ingredientNamed("jam"))!.id,
      });
    });

    it("gives steak to beef steak, and takes chicken drumstick off chicken thigh, when the file is applied", async () => {
      await applySeedFile(
        `${excerpt}\n\nen: patty, patties\nfr: steak\n\nen: beef steak\n\n` +
          `en: chicken thigh, chicken drumstick\n`
      );

      await expect(resolve("steak")).resolves.toMatchObject({
        ingredientId: (await ingredientNamed("beef steak"))!.id,
      });
      await expect(getSpellingTexts((await ingredientNamed("chicken thigh"))!.id)).resolves.toEqual(
        ["chicken thigh"]
      );
    });

    it("takes chicken drumstick off chicken thigh once on an instance seeded before, its lines read again", async () => {
      await applySeedFile(`${excerpt}\n\nen: chicken thigh\n`);
      const thigh = (await ingredientNamed("chicken thigh"))!.id;
      // As a seed from before the correction left it.
      const [drumstick] = await getTestDb()
        .insert(ingredientAliases)
        .values({
          ingredientId: thigh,
          text: "chicken drumstick",
          fold: ingredientAliasFold("chicken drumstick"),
          locale: "en",
          seeded: true,
        })
        .returning({ id: ingredientAliases.id });
      const line = await nameInATestRecipe(actor.userId, drumstick!.id, "chicken drumstick");

      await updateIngredientSeedState({ correctionsVersion: SEED_CORRECTIONS_VERSION - 1 });
      await expect(correctSeedOnce()).resolves.toEqual({ moved: 1, refiled: 0 });

      await expect(getSpellingTexts(thigh)).resolves.toEqual(["chicken thigh"]);
      const own = await ingredientNamed("chicken drumstick");

      expect(own).toMatchObject({ offId: null });
      expect((await findRecipeLineAliases([line.id])).get(line.id)?.foods).toEqual([
        expect.objectContaining({ ingredientId: own!.id }),
      ]);
    });

    it("files a spelling an entry's languages share under the one Norish reads, also on an instance seeded before", async () => {
      // Open Food Facts lists Afrikaans before Dutch, and the first claim kept the spelling.
      const file = `${excerpt}\n\nen: cheese\naf: Kaas\nnl: kaas\n`;
      const cheese = async () => (await ingredientNamed("cheese"))!.id;
      const kaasIn = (locale: string) =>
        getTestDb()
          .update(ingredientAliases)
          .set({ locale })
          .where(eq(ingredientAliases.fold, "kaas"));

      await refreshIngredientCatalogue(serving(file, '"v1"').fetchImpl);
      await expect(parentOf((await resolve("belegen kaas")).ingredientId)).resolves.toBe(
        await cheese()
      );
      // A first seed is made with every correction: nothing to read again.
      await expect(correctSeedOnce()).resolves.toBeNull();

      // As a seed from before the correction left it.
      await kaasIn("af");
      await updateIngredientSeedState({ correctionsVersion: 2 });
      await expect(parentOf((await resolve("jonge kaas")).ingredientId)).resolves.toBeNull();

      // The boot downloads nothing: it forgets the file's validators, so the nightly refresh applies it.
      const offline = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      try {
        await expect(correctSeedOnce()).resolves.toEqual({ moved: 0, refiled: 0 });
      } finally {
        offline.mockRestore();
      }
      expect(offline).not.toHaveBeenCalled();
      await expect(readIngredientSeedState()).resolves.toMatchObject({
        etag: null,
        lastModified: null,
        correctionsVersion: SEED_CORRECTIONS_VERSION,
      });
      await refreshIngredientCatalogue(serving(file, '"v1"').fetchImpl);

      await expect(parentOf((await resolve("oude kaas")).ingredientId)).resolves.toBe(
        await cheese()
      );
    });

    it("moves seasoning off coating once on an instance seeded before, with the foods its words filed there", async () => {
      await applySeedFile(spices);
      const mixed = await resolve("mixed spices");
      const coating = await resolve("coating");

      // As a seed from before the correction left it.
      await moveAlias(admin, await seasoningAlias(), coating.ingredientId);
      const cajun = await resolve("cajun seasoning");
      const chicken = await resolve("chicken seasoning");
      const ranch = await resolve("ranch seasoning");
      // Only a grocery names it: a hidden food keeps its parent, and so its aisle.
      const bbq = await resolve("bbq seasoning");

      await nameInATestRecipe(actor.userId, chicken.aliasId, "chicken seasoning");
      await getTestDb().insert(groceries).values({
        userId: actor.userId,
        name: "bbq seasoning",
        ingredientAliasId: bbq.aliasId,
        ingredientId: bbq.ingredientId,
      });
      await setParent(admin, ranch.ingredientId, coating.ingredientId);
      // AI's open unsure answer names coating, though the words are sure of it.
      await nameInATestRecipe(actor.userId, cajun.aliasId, "cajun seasoning");
      await parentByAI(cajun.ingredientId, null, false);
      await parentByAI(cajun.ingredientId, coating.ingredientId, false);
      await expect(ingredientNamed("cajun seasoning")).resolves.toMatchObject({ flagged: true });

      await expect(correctSeedOnce()).resolves.toMatchObject({ moved: 1, refiled: 2 });

      await expect(resolve("seasoning")).resolves.toMatchObject({
        ingredientId: mixed.ingredientId,
      });
      await expect(parentOf(cajun.ingredientId)).resolves.toBe(mixed.ingredientId);
      await expect(parentOf(chicken.ingredientId)).resolves.toBe(mixed.ingredientId);
      // A parent a person chose stays.
      await expect(parentOf(ranch.ingredientId)).resolves.toBe(coating.ingredientId);
      await expect(parentOf(bbq.ingredientId)).resolves.toBe(coating.ingredientId);
      // AI's stale answer went with the old parent.
      await expect(listAIChanges()).resolves.toEqual([]);
      await expect(ingredientNamed("cajun seasoning")).resolves.toMatchObject({ flagged: false });

      // The nightly refresh leaves it there.
      await applySeedFile(spices);
      await expect(resolve("seasoning")).resolves.toMatchObject({
        ingredientId: mixed.ingredientId,
      });

      // Once: a person who moves it back is not overruled at the next boot.
      await moveAlias(admin, await seasoningAlias(), coating.ingredientId);
      await expect(correctSeedOnce()).resolves.toBeNull();
      await expect(resolve("seasoning")).resolves.toMatchObject({
        ingredientId: coating.ingredientId,
      });
    });
  });

  describe("the junk pile seed", () => {
    it("has every concept in every language Norish reads", () => {
      for (const [concept, { texts }] of Object.entries(JUNK_SEED_CONCEPTS)) {
        expect([concept, Object.keys(texts).sort()]).toEqual([
          concept,
          [...CATALOGUE_LANGUAGES].sort(),
        ]);
      }
    });

    it("puts its texts on the pile once per version, never again one a person took off", async () => {
      const outcome = await seedJunkPileOnce();

      expect(outcome).toEqual({ added: 211 });
      expect((await listJunkFolds()).sort()).toEqual(
        JUNK_SEED.map((entry) => ingredientAliasFold(entry.text)).sort()
      );
      await expect(resolveIngredients(["boneless"], { userId: actor.userId })).resolves.toEqual([
        null,
      ]);

      // A person says "boneless" names a food: it leaves the pile, and stays off.
      const chicken = await resolve("chicken breast");

      await addAlias(actor, chicken.ingredientId, "boneless");
      await expect(seedJunkPileOnce()).resolves.toBeNull();
      expect(await listJunkFolds()).not.toContain("boneless");

      // A later version adds only its own entries.
      const later = [...JUNK_SEED, { text: "afgemeten", version: JUNK_SEED_VERSION + 1 }];

      await expect(seedJunkPileOnce(later)).resolves.toEqual({ added: 1 });
      expect(await listJunkFolds()).toContain("afgemeten");
      expect(await listJunkFolds()).not.toContain("boneless");
      await expect(seedJunkPileOnce(later)).resolves.toBeNull();
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
    it("merges an existing Ingredient the seed knows into its entry, once", async () => {
      const onions = await resolve("onions");
      const sjalot = serving(excerpt, '"v1"');

      await expect(refreshIngredientCatalogue(sjalot.fetchImpl)).resolves.toBe("applied");

      const onion = await resolve("onion");

      expect(onion.ingredientId).not.toBe(onions.ingredientId);
      // Merged: the old spelling now names the seeded food.
      await expect(findIngredientByAliasId(onions.aliasId)).resolves.toMatchObject({
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

    it("refuses a file listing far fewer foods than the last seed, and removes nothing", async () => {
      await refreshIngredientCatalogue(serving(excerpt, '"v1"').fetchImpl);
      const truncated = serving("en: vegetable\n\nen: onion\n", '"v2"');

      await expect(refreshIngredientCatalogue(truncated.fetchImpl)).rejects.toThrow("far fewer");
      await expect(ingredientNamed("imazalil")).resolves.not.toBeNull();
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

  describe("names in the viewer's language", () => {
    it("gives a Pantry Ingredient its name in every language a viewer may read", async () => {
      await applySeedFile(excerpt);
      const userIds = [actor.userId];

      await addToPantry(crypto.randomUUID(), { userId: actor.userId, userIds, name: "uien" });

      const [item] = await listPantryIngredientsByUserIds(userIds);

      expect(item).toMatchObject({ name: "onion" });
      expect(item?.localeNames).toMatchObject({
        en: "onion",
        nl: "ui",
        de: "Zwiebel",
        fr: "oignon",
      });
    });

    it("finds an Ingredient on the Ingredients page by a spelling in any language", async () => {
      await applySeedFile(excerpt);

      const found = await listIngredients(actor, { search: "zwiebeln" });

      expect(found.items.map((item) => item.name)).toContain("onion");
      expect(found.items.find((item) => item.name === "onion")?.localeNames.nl).toBe("ui");
    });
  });
});
