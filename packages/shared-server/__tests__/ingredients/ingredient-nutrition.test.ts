// @vitest-environment node
/**
 * Ingredient Nutrition against a real database (ADR-0039): what a household
 * reads as an Ingredient's numbers per 100 g, piece weight and density, and
 * where each came from, through every step of the lookup order, the tree,
 * the lenders that never lend and the household's own corrections.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SeedEntry } from "@norish/db/repositories/ingredient-seed";
import type { NutritionCodes } from "@norish/db/schema";
import type { SourceTable } from "@norish/shared-server/ingredients/nutrition/source-table";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { getRecipeFull } from "@norish/db";
import { saveNutritionCorrection } from "@norish/db/repositories/ingredient-nutrition";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import {
  clearRecipeNutritionEstimate,
  saveRecipeNutritionEstimate,
} from "@norish/db/repositories/recipe-enrichment";
import { serverConfig } from "@norish/db/schema";
import { setParent } from "@norish/shared-server/ingredients/catalogue";
import {
  applySourceTable,
  applySourceTableOnVersionChange,
} from "@norish/shared-server/ingredients/nutrition/apply-sources";
import {
  correctNutrition,
  NutritionCorrectionError,
  removeNutritionCorrection,
  searchDatasetFoods,
} from "@norish/shared-server/ingredients/nutrition/corrections";
import {
  NO_HOUSEHOLD,
  resolveIngredientNutrition,
} from "@norish/shared-server/ingredients/nutrition/ingredient-nutrition";
import { workOutRecipeNutrition } from "@norish/shared-server/ingredients/nutrition/recipe-nutrition";
import { buildCatalogueExport } from "@norish/shared-server/ingredients/seed/catalogue-export";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { createTestUser, getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const TABLE: SourceTable = {
  version: "test-1",
  editions: { ciqual: "2025-11-03" },
  foods: [
    ["ciqual", "20034", "Onion, raw", 35, 0.2, 6.8, 1.1, null, null, null],
    ["usda", "170000", "Onions, raw", 40, 0.1, 9.3, 1.1, 110, 0.67, "11282"],
    ["ciqual", "1014", "Pure alcohol", 660, 0, 0, 0, null, null, null],
    ["ciqual", "5215", "Wine, white, dry", 55, 0, 0.2, 0.3, null, null, null],
    ["ciqual", "19051", "Milk, skimmed, pasteurised", 33, 0.1, 4.7, 3.4, null, null, null],
    ["ciqual", "19016", "Milk, whole (average)", 64, 3.5, 4.8, 3.4, null, null, null],
    ["ciqual", "19041", "Milk, semi-skimmed, UHT", 47.7, 1.6, 5, 3.5, null, null, null],
    ["ciqual-2020", "20504", "Lentil, dried", 300, 1.5, 50, 24, null, null, null],
    ["calnut", "13050", "Apple, pulp, raw", 49, 0.2, 10.8, 0.3, null, null, null],
    ["usda", "999", "Kale, raw", 35, 1.5, 4.4, 2.9, 25, 0.07, null],
    ["ciqual", "11", "Celeriac, raw", 31, 0.4, 2.3, 1.2, null, null, null],
    ["cofid", "13-336", "Sauerkraut", 9, 0, 1, 1.1, null, null, null],
    ["ciqual", "11184", "Sauce (average)", 246, 22, 9, 1.5, null, null, null],
    ["usda", "999001", "Cumin, whole", 380, 21, 40, 17, null, 0.3, null],
    ["usda", "170923", "Spices, cumin seed", 375, 22, 44, 18, null, 0.4, null],
    ["usda", "171595", "Sauce, tomato chili sauce, bottled", 104, 0.3, 20, 2.5, null, 1.1375, null],
    ["usda", "170924", "Spices, curry powder", 325, 14, 55, 14, null, 0.42, null],
    ["cofid", "13-829", "Garam masala", 379, 15, 45, 15, null, null, null],
    ["usda", "170169", "Nuts, coconut meat, raw", 354, 33, 15, 3.3, 397, 0.3333, "12104"],
    ["ciqual", "15007", "Coconut, pulp, dried", 680, 64, 7, 7, null, null, null],
  ],
  fixes: { "en:milk": "ciqual:19016", "en:cumin": "usda:999001" },
  densityFixes: {
    "en:cumin": "usda:170923",
    "en:sauce": "usda:171595",
    "en:spice": "usda:170924",
  },
  names: {
    "en:sauerkraut": "cofid:13-336",
    "en:sauce": "ciqual:11184",
    "en:garam-masala": "cofid:13-829",
  },
  neverLend: ["en:alcohol", "en:sauce", "en:coconut"],
};

function codes(partial: Partial<NutritionCodes>): NutritionCodes {
  return { ciqual: [], usda: [], ciqualOther: [], pieceWeight: null, density: null, ...partial };
}

function entry(
  offId: string,
  parentOffId: string | null,
  nutrition: NutritionCodes | null = null
): SeedEntry {
  const name = offId.slice(3).replace(/-/g, " ");

  return {
    offId,
    name,
    nameFold: ingredientAliasFold(name),
    parentOffId,
    aliases: [{ text: name, fold: ingredientAliasFold(name), locale: "en" }],
    nutrition,
  };
}

const ENTRIES = [
  entry("en:vegetable", null),
  entry(
    "en:onion",
    "en:vegetable",
    codes({ ciqual: ["20034"], usda: ["ndb:11282"], pieceWeight: 150 })
  ),
  entry("en:red-onion", "en:onion"),
  entry("en:pickled-red-onion", "en:red-onion"),
  entry("en:alcohol", null, codes({ ciqual: ["1014"] })),
  entry("en:wine", "en:alcohol"),
  entry("en:white-wine", "en:wine", codes({ ciqual: ["5215"] })),
  entry("en:brandy", "en:alcohol"),
  entry("en:milk", null, codes({ ciqual: ["19051"], density: 1.03 })),
  entry("en:lentil", null, codes({ ciqual: ["20504"] })),
  entry("en:apple", null, codes({ ciqual: ["13050"] })),
  entry("en:kale", null, codes({ usda: ["fdc:999"] })),
  entry("en:celery", null, codes({ ciqualOther: ["11"] })),
  entry("en:sauerkraut", null),
  entry("en:sauce", null),
  entry("en:hot-sauce", "en:sauce"),
  entry("en:cumin", null),
  entry("en:spice", null),
  entry("en:mixed-spices", "en:spice"),
  entry("en:garam-masala", "en:mixed-spices"),
  entry("en:coconut", null, codes({ usda: ["ndb:12104"] })),
  entry("en:desiccated-coconut", "en:coconut", codes({ ciqual: ["15007"] })),
];

describe("Ingredient Nutrition", () => {
  const testBase = new RepositoryTestBase("test_ingredient_nutrition");

  let id: (offId: string) => string;
  let recipeId: string;
  let householdA: string[];
  let householdB: string[];

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [first, recipe] = await testBase.beforeEachTest();

    recipeId = recipe.id;
    const second = await createTestUser();
    const stranger = await createTestUser();

    householdA = [first.id, second!.id];
    householdB = [stranger!.id];
    await getTestDb()
      .delete(serverConfig)
      .where(eq(serverConfig.key, ServerConfigKeys.INGREDIENT_SEED_STATE));
    await applySourceTable(TABLE);
    await applyIngredientSeed(ENTRIES);

    const seeded = await listSeededIngredientIds();

    id = (offId) => seeded.get(offId)!;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function read(offId: string, householdUserIds: readonly string[] = []) {
    const answer = await resolveIngredientNutrition([id(offId)], { householdUserIds });

    return answer.get(id(offId))!;
  }

  describe("the lookup order", () => {
    it("reads an Ingredient's own CIQUAL code, with the taxonomy's piece weight and USDA's density", async () => {
      await expect(read("en:onion")).resolves.toEqual({
        numbers: {
          value: { kcal: 35, fat: 0.2, carbs: 6.8, protein: 1.1 },
          source: { kind: "code", food: { dataset: "ciqual", code: "20034", name: "Onion, raw" } },
          borrowedFrom: null,
        },
        pieceWeight: { value: 150, source: { kind: "taxonomy" }, borrowedFrom: null },
        density: {
          value: 0.67,
          source: { kind: "code", food: { dataset: "usda", code: "170000", name: "Onions, raw" } },
          borrowedFrom: null,
        },
      });
    });

    it("takes Norish's fix above the Ingredient's own code", async () => {
      const milk = await read("en:milk");

      expect(milk.numbers).toMatchObject({
        value: { kcal: 64 },
        source: { kind: "fix", food: { name: "Milk, whole (average)" } },
      });
      // The fix names a food without a density, so the taxonomy's own stays.
      expect(milk.density).toMatchObject({ value: 1.03, source: { kind: "taxonomy" } });
    });

    it("reads CIQUAL 2020 where 2025 has no numbers, and CALNUT where neither has", async () => {
      expect((await read("en:lentil")).numbers?.source).toMatchObject({
        food: { dataset: "ciqual-2020", code: "20504" },
      });
      expect((await read("en:apple")).numbers?.source).toMatchObject({
        food: { dataset: "calnut", code: "13050" },
      });
    });

    it("reads a USDA code with its portions, another CIQUAL-keyed code, and a name match", async () => {
      expect(await read("en:kale")).toMatchObject({
        numbers: { value: { kcal: 35 }, source: { kind: "code", food: { dataset: "usda" } } },
        pieceWeight: { value: 25 },
        density: { value: 0.07 },
      });
      expect((await read("en:celery")).numbers?.source).toMatchObject({
        kind: "code",
        food: { name: "Celeriac, raw" },
      });
      expect((await read("en:sauerkraut")).numbers).toMatchObject({
        value: { kcal: 9 },
        source: { kind: "name", food: { dataset: "cofid", name: "Sauerkraut" } },
      });
    });

    it("reads an Ingredient's own code before what an ancestor would lend: white wine is not pure alcohol", async () => {
      expect((await read("en:white-wine")).numbers).toMatchObject({
        value: { kcal: 55 },
        borrowedFrom: null,
      });
    });
  });

  describe("borrowing from a parent", () => {
    it("borrows every fact from the nearest Parent Ingredient that has it, and says from whom", async () => {
      const red = await read("en:red-onion");

      expect(red.numbers).toMatchObject({
        value: { kcal: 35 },
        borrowedFrom: { id: id("en:onion"), name: "onion" },
      });
      expect(red.pieceWeight).toMatchObject({ value: 150, borrowedFrom: { name: "onion" } });
    });

    it("borrows across several levels, past an ancestor with no numbers of its own", async () => {
      expect((await read("en:pickled-red-onion")).numbers).toMatchObject({
        value: { kcal: 35 },
        borrowedFrom: { id: id("en:onion") },
      });
    });

    it("never borrows from a lender that never lends, nor past one", async () => {
      await expect(read("en:brandy")).resolves.toEqual({
        numbers: null,
        pieceWeight: null,
        density: null,
      });
      expect((await read("en:wine")).numbers).toBeNull();
      expect((await read("en:hot-sauce")).numbers).toBeNull();
      // A lender that never lends still has numbers of its own.
      expect((await read("en:sauce")).numbers).toMatchObject({ value: { kcal: 246 } });
    });

    it("borrows from whatever parent a person gives it", async () => {
      await setParent(
        { userId: householdA[0]!, householdUserIds: householdA, isServerAdmin: true },
        id("en:red-onion"),
        id("en:milk")
      );

      expect((await read("en:red-onion")).numbers).toMatchObject({
        value: { kcal: 64 },
        borrowedFrom: { id: id("en:milk") },
      });
    });
  });

  describe("a spoon's weight", () => {
    it("takes a density fix before the fix list, for the density alone", async () => {
      expect(await read("en:cumin")).toMatchObject({
        numbers: {
          value: { kcal: 380 },
          source: { kind: "fix", food: { name: "Cumin, whole" } },
        },
        density: {
          value: 0.4,
          source: {
            kind: "fix",
            food: { dataset: "usda", code: "170923", name: "Spices, cumin seed" },
          },
          borrowedFrom: null,
        },
      });
    });

    it("still gives the household's own correction the last word", async () => {
      await saveNutritionCorrection(householdA[0]!, id("en:cumin"), {
        numbersFood: null,
        kcal: null,
        fat: null,
        carbs: null,
        protein: null,
        pieceWeightFood: null,
        pieceWeight: null,
        densityFood: null,
        density: 0.5,
      });

      expect((await read("en:cumin", householdA)).density).toMatchObject({
        value: 0.5,
        source: { kind: "household" },
      });
    });

    it("lends a group's density to its members, at any distance", async () => {
      expect(await read("en:garam-masala")).toMatchObject({
        numbers: { value: { kcal: 379 }, source: { kind: "name" }, borrowedFrom: null },
        density: {
          value: 0.42,
          source: { kind: "fix", food: { name: "Spices, curry powder" } },
          borrowedFrom: { id: id("en:spice"), name: "spice" },
        },
      });
    });

    it("walks past a lender that never lends its numbers, which still end there", async () => {
      expect(await read("en:hot-sauce")).toMatchObject({
        numbers: null,
        density: { value: 1.1375, borrowedFrom: { id: id("en:sauce") } },
      });
      expect(await read("en:desiccated-coconut")).toMatchObject({
        numbers: { value: { kcal: 680 }, borrowedFrom: null },
        // A piece weight keeps the list: a coconut is no piece of desiccated coconut.
        pieceWeight: null,
        density: { value: 0.3333, borrowedFrom: { id: id("en:coconut"), name: "coconut" } },
      });
    });
  });

  describe("a household's correction", () => {
    const semiSkimmed = {
      numbersFood: "ciqual:19041",
      kcal: null,
      fat: null,
      carbs: null,
      protein: null,
      pieceWeightFood: null,
      pieceWeight: null,
      densityFood: null,
      density: null,
    };

    it("is the last word for the household, and invisible to another", async () => {
      await saveNutritionCorrection(householdA[1]!, id("en:milk"), semiSkimmed);

      expect((await read("en:milk", householdA)).numbers).toMatchObject({
        value: { kcal: 47.7 },
        source: { kind: "household-food", food: { name: "Milk, semi-skimmed, UHT" } },
      });
      expect((await read("en:milk", householdB)).numbers).toMatchObject({ value: { kcal: 64 } });
      expect((await read("en:milk")).numbers).toMatchObject({ value: { kcal: 64 } });
    });

    it("takes the most recent correction any member of the household made", async () => {
      await saveNutritionCorrection(householdA[0]!, id("en:milk"), semiSkimmed);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await saveNutritionCorrection(householdA[1]!, id("en:milk"), {
        ...semiSkimmed,
        numbersFood: null,
        kcal: 50,
        fat: 2,
        carbs: 5,
        protein: 3,
      });

      expect((await read("en:milk", householdA)).numbers).toEqual({
        value: { kcal: 50, fat: 2, carbs: 5, protein: 3 },
        source: { kind: "household" },
        borrowedFrom: null,
      });
    });

    it("corrects a piece weight and a density fact by fact, leaving the rest to the sources", async () => {
      await saveNutritionCorrection(householdA[0]!, id("en:onion"), {
        ...semiSkimmed,
        numbersFood: null,
        pieceWeightFood: "usda:170000",
        density: 0.5,
      });

      expect(await read("en:onion", householdA)).toMatchObject({
        numbers: { value: { kcal: 35 }, source: { kind: "code" } },
        pieceWeight: { value: 110, source: { kind: "household-food" } },
        density: { value: 0.5, source: { kind: "household" } },
      });
    });

    it("reaches a child that borrows from the corrected parent", async () => {
      await saveNutritionCorrection(householdA[0]!, id("en:onion"), {
        ...semiSkimmed,
        numbersFood: null,
        kcal: 42,
        fat: 0,
        carbs: 9,
        protein: 1,
      });

      expect((await read("en:red-onion", householdA)).numbers).toMatchObject({
        value: { kcal: 42 },
        source: { kind: "household" },
        borrowedFrom: { id: id("en:onion") },
      });
    });

    it("outlives a new source table", async () => {
      await saveNutritionCorrection(householdA[0]!, id("en:milk"), semiSkimmed);
      await applySourceTable({ ...TABLE, version: "test-2", fixes: {} });

      expect((await read("en:milk", householdA)).numbers).toMatchObject({
        value: { kcal: 47.7 },
        source: { kind: "household-food" },
      });
      expect((await read("en:milk", householdB)).numbers).toMatchObject({ value: { kcal: 33 } });
    });
  });

  describe("correcting through the module", () => {
    const member = (userId: string, household: string[]) => ({
      userId,
      householdUserIds: household,
      householdKey: `household-of-${household[0]}`,
    });

    it("lets any member correct any food, seeded or not, by a dataset food or a label", async () => {
      await correctNutrition(member(householdA[1]!, householdA), id("en:milk"), {
        numbers: { food: "ciqual:19041" },
        pieceWeight: null,
        density: { gramsPerMl: 1.04 },
      });

      expect(await read("en:milk", householdA)).toMatchObject({
        numbers: { value: { kcal: 47.7 }, source: { kind: "household-food" } },
        density: { value: 1.04, source: { kind: "household" } },
      });
    });

    it("refuses a dataset food Norish does not have, and a correction of nothing", async () => {
      await expect(
        correctNutrition(member(householdA[0]!, householdA), id("en:milk"), {
          numbers: { food: "ciqual:99999" },
          pieceWeight: null,
          density: null,
        })
      ).rejects.toThrow(NutritionCorrectionError);
      await expect(
        correctNutrition(member(householdA[0]!, householdA), id("en:milk"), {
          numbers: null,
          pieceWeight: null,
          density: null,
        })
      ).rejects.toMatchObject({ refusal: "empty" });
      await expect(
        correctNutrition(member(householdA[0]!, householdA), crypto.randomUUID(), {
          numbers: null,
          pieceWeight: { grams: 100 },
          density: null,
        })
      ).rejects.toMatchObject({ refusal: "not-found" });
    });

    it("removes every member's correction, back to the datasets' numbers", async () => {
      await correctNutrition(member(householdA[0]!, householdA), id("en:milk"), {
        numbers: { kcal: 50, fat: 2, carbs: 5, protein: 3 },
        pieceWeight: null,
        density: null,
      });
      await correctNutrition(member(householdA[1]!, householdA), id("en:milk"), {
        numbers: { food: "ciqual:19041" },
        pieceWeight: null,
        density: null,
      });
      await removeNutritionCorrection(member(householdA[0]!, householdA), id("en:milk"));

      expect((await read("en:milk", householdA)).numbers).toMatchObject({
        value: { kcal: 64 },
        source: { kind: "fix" },
      });
    });

    it("finds dataset foods by every word of their names", async () => {
      await expect(searchDatasetFoods("milk semi")).resolves.toEqual([
        expect.objectContaining({
          dataset: "ciqual",
          code: "19041",
          name: "Milk, semi-skimmed, UHT",
        }),
      ]);
      await expect(searchDatasetFoods("milk banana")).resolves.toEqual([]);
    });
  });

  describe("a recipe's total on the server, for the language model's estimate", () => {
    const recipe = (calories: number | null = null) => ({
      servings: 2,
      systemUsed: "metric",
      calories,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [
        {
          id: "a",
          ingredientName: "onion",
          ingredientId: id("en:onion"),
          amount: 2,
          unit: null,
          systemUsed: "metric",
        },
        {
          id: "b",
          ingredientName: "brandy",
          ingredientId: id("en:brandy"),
          amount: 50,
          unit: "milliliter",
          systemUsed: "metric",
        },
      ],
    });

    it("counts from the datasets' numbers, and names what it left out", async () => {
      const worked = await workOutRecipeNutrition(recipe(), NO_HOUSEHOLD);

      expect(worked?.counted).toEqual([
        expect.objectContaining({ lineId: "a", grams: 300, calories: 105 }),
      ]);
      expect(worked?.uncounted.map((line) => line.lineId)).toEqual(["b"]);
    });

    it("works nothing out for a recipe that supplies its own", async () => {
      await expect(workOutRecipeNutrition(recipe(320), NO_HOUSEHOLD)).resolves.toBeNull();
    });

    it("carries the language model's stored shares on the recipe, until they are dropped", async () => {
      const line = { key: "key", calories: 60, fat: 0, carbs: 1, protein: 0 };

      await saveRecipeNutritionEstimate(recipeId, { lines: [line] });
      expect((await getRecipeFull(recipeId))?.nutritionEstimate).toEqual({ lines: [line] });

      await saveRecipeNutritionEstimate(recipeId, { lines: [{ ...line, calories: 70 }] });
      expect((await getRecipeFull(recipeId))?.nutritionEstimate).toEqual({
        lines: [{ ...line, calories: 70 }],
      });

      await expect(clearRecipeNutritionEstimate(recipeId)).resolves.toBe(true);
      expect((await getRecipeFull(recipeId))?.nutritionEstimate).toBeNull();
    });
  });

  describe("the catalogue export", () => {
    it("carries each Ingredient's codes and the datasets' numbers, and no household's correction", async () => {
      await saveNutritionCorrection(householdA[0]!, id("en:onion"), {
        numbersFood: null,
        kcal: 99,
        fat: 9,
        carbs: 9,
        protein: 9,
        pieceWeightFood: null,
        pieceWeight: 99,
        densityFood: null,
        density: null,
      });

      const catalogue = await buildCatalogueExport(new Date("2026-10-01T00:00:00Z"));
      const onion = catalogue.ingredients.find((ingredient) => ingredient.id === id("en:onion"));
      const red = catalogue.ingredients.find((ingredient) => ingredient.id === id("en:red-onion"));

      expect(catalogue.nutritionSources.map((source) => source.name).join(" ")).toMatch(
        /Ciqual.*CALNUT.*FoodData Central.*CoFID/
      );
      expect(onion).toMatchObject({
        nutritionCodes: { ciqual: ["20034"], usda: ["ndb:11282"], pieceWeight: 150 },
        nutrition: {
          per100g: { value: { kcal: 35 }, source: "ciqual:20034", borrowedFrom: null },
          pieceWeight: { value: 150, source: "taxonomy" },
          density: { value: 0.67, source: "usda:170000" },
        },
      });
      expect(red?.nutrition.per100g).toMatchObject({ borrowedFrom: id("en:onion") });
      expect(JSON.stringify(catalogue)).not.toContain('"kcal":99');
    });
  });

  describe("applying the source table at boot", () => {
    it("applies a table only when its version changed", async () => {
      await expect(applySourceTableOnVersionChange(() => TABLE)).resolves.toBe("test-1");
      await expect(applySourceTableOnVersionChange(() => TABLE)).resolves.toBeNull();
      await expect(
        applySourceTableOnVersionChange(() => ({ ...TABLE, version: "test-2", fixes: {} }))
      ).resolves.toBe("test-2");
      expect((await read("en:milk")).numbers).toMatchObject({ value: { kcal: 33 } });
    });

    it("leaves the last good numbers where a table cannot be applied", async () => {
      await applySourceTableOnVersionChange(() => TABLE);

      const broken = {
        ...TABLE,
        version: "test-3",
        foods: [...TABLE.foods, TABLE.foods[0]!],
      } satisfies SourceTable;

      await expect(applySourceTableOnVersionChange(() => broken)).rejects.toThrow();
      expect((await read("en:onion")).numbers).toMatchObject({ value: { kcal: 35 } });
      await expect(applySourceTableOnVersionChange(() => TABLE)).resolves.toBeNull();
    });

    it("answers nothing for an Ingredient no household reads, without corrections", async () => {
      await expect(
        resolveIngredientNutrition([crypto.randomUUID()], NO_HOUSEHOLD)
      ).resolves.toEqual(new Map());
    });
  });
});
