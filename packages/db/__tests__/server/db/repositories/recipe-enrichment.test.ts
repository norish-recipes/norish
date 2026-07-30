// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { findCuisineByName, getRecipeCuisines } from "@norish/db/repositories/cuisines";
import {
  clearRecipeProvenance,
  replaceRecipeCategories,
  replaceRecipeNutrition,
  replaceRecipeProvenance,
} from "@norish/db/repositories/recipe-enrichment";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import { appendRecipeTags, getRecipeTagNames } from "@norish/db/repositories/tags";

import { createTestRecipe } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const testBase = new RepositoryTestBase("test_recipe_enrichment");
let userId: string;
let testRecipe: Awaited<ReturnType<typeof createTestRecipe>>;

describe("Recipe Enrichment repository", () => {
  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user, recipe] = await testBase.beforeEachTest();
    userId = user.id;
    testRecipe = recipe;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  describe("appendRecipeTags", () => {
    it("adds new tags without removing existing ones", async () => {
      await appendRecipeTags(testRecipe.id, ["Supplied"]);
      const result = await appendRecipeTags(testRecipe.id, ["Vegan", "Quick"]);

      expect(result.added).toEqual(["Vegan", "Quick"]);
      expect(await getRecipeTagNames(testRecipe.id)).toEqual(
        expect.arrayContaining(["Supplied", "Vegan", "Quick"])
      );
    });

    it("is idempotent under job retry", async () => {
      await appendRecipeTags(testRecipe.id, ["Vegan"]);
      const second = await appendRecipeTags(testRecipe.id, ["Vegan"]);

      expect(second.added).toEqual([]);
      expect(await getRecipeTagNames(testRecipe.id)).toEqual(["Vegan"]);
    });

    it("normalizes duplicates, blanks, and casing", async () => {
      await appendRecipeTags(testRecipe.id, ["Vegan"]);
      const result = await appendRecipeTags(testRecipe.id, [
        "  vegan ",
        "",
        "   ",
        "Quick",
        "quick",
      ]);

      expect(result.added).toEqual(["Quick"]);
      expect(await getRecipeTagNames(testRecipe.id)).toEqual(["Vegan", "Quick"]);
    });

    it("keeps both finding sets when two appends run concurrently", async () => {
      await appendRecipeTags(testRecipe.id, ["Supplied"]);

      await Promise.all([
        appendRecipeTags(testRecipe.id, ["Tag-A", "Tag-B"]),
        appendRecipeTags(testRecipe.id, ["Allergen-Milk", "Allergen-Egg"]),
      ]);

      expect(await getRecipeTagNames(testRecipe.id)).toEqual(
        expect.arrayContaining(["Supplied", "Tag-A", "Tag-B", "Allergen-Milk", "Allergen-Egg"])
      );
    });
  });

  describe("replaceRecipeCategories", () => {
    it("replaces the complete list unconditionally", async () => {
      await replaceRecipeCategories(testRecipe.id, ["Breakfast"], "manual");
      const applied = await replaceRecipeCategories(testRecipe.id, ["Dinner", "Snack"], "manual");

      expect(applied).toBe(true);
      expect((await getRecipeFull(testRecipe.id))?.categories).toEqual(["Dinner", "Snack"]);
    });

    it("rejects an empty proposal without touching stored values", async () => {
      await replaceRecipeCategories(testRecipe.id, ["Breakfast"], "manual");

      await expect(replaceRecipeCategories(testRecipe.id, [], "manual")).rejects.toThrow();
      expect((await getRecipeFull(testRecipe.id))?.categories).toEqual(["Breakfast"]);
    });
  });

  describe("replaceRecipeCategories with the automatic origin", () => {
    it("applies while the stored list is empty", async () => {
      const applied = await replaceRecipeCategories(testRecipe.id, ["Dinner"], "automatic");

      expect(applied).toBe(true);
      expect((await getRecipeFull(testRecipe.id))?.categories).toEqual(["Dinner"]);
    });

    it("becomes a no-op when data appeared while AI was running", async () => {
      await replaceRecipeCategories(testRecipe.id, ["Breakfast"], "manual");

      const applied = await replaceRecipeCategories(testRecipe.id, ["Dinner"], "automatic");

      expect(applied).toBe(false);
      expect((await getRecipeFull(testRecipe.id))?.categories).toEqual(["Breakfast"]);
    });
  });

  describe("replaceRecipeNutrition", () => {
    it("replaces the whole group atomically and clears omitted fields", async () => {
      await replaceRecipeNutrition(
        testRecipe.id,
        { calories: 500, fat: "20", carbs: "40", protein: "30" },
        "manual"
      );

      const applied = await replaceRecipeNutrition(testRecipe.id, { calories: 240 }, "manual");

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.calories).toBe(240);
      expect(recipe?.fat).toBeNull();
      expect(recipe?.carbs).toBeNull();
      expect(recipe?.protein).toBeNull();
    });

    it("rejects an entirely blank proposal without touching stored values", async () => {
      await replaceRecipeNutrition(testRecipe.id, { calories: 500 }, "manual");

      await expect(
        replaceRecipeNutrition(
          testRecipe.id,
          { calories: null, fat: "  ", carbs: "", protein: null },
          "manual"
        )
      ).rejects.toThrow();
      expect((await getRecipeFull(testRecipe.id))?.calories).toBe(500);
    });
  });

  describe("replaceRecipeNutrition with the automatic origin", () => {
    it("applies while the whole group is absent", async () => {
      const applied = await replaceRecipeNutrition(
        testRecipe.id,
        { calories: 240, fat: "9", carbs: "30", protein: "12" },
        "automatic"
      );

      expect(applied).toBe(true);
      expect((await getRecipeFull(testRecipe.id))?.calories).toBe(240);
    });

    it("leaves partial supplied nutrition untouched", async () => {
      const supplied = await createTestRecipe(userId, { name: "Supplied protein", protein: "31" });

      const applied = await replaceRecipeNutrition(
        supplied.id,
        { calories: 240, fat: "9", carbs: "30", protein: "12" },
        "automatic"
      );

      expect(applied).toBe(false);

      const recipe = await getRecipeFull(supplied.id);

      expect(recipe?.protein).toBe("31.00");
      expect(recipe?.calories).toBeNull();
    });
  });

  describe("replaceRecipeProvenance", () => {
    async function cuisineId(name: string): Promise<string> {
      const cuisine = await findCuisineByName(name);

      if (!cuisine) throw new Error(`Seeded Cuisine missing: ${name}`);

      return cuisine.id;
    }

    it("writes the scalar fields, the note, and the join rows in one operation", async () => {
      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        {
          originCountry: "IT",
          originRegion: "Lazio",
          provenanceNote: "Una classica ricetta romana.",
          cuisineIds: [await cuisineId("Italian"), await cuisineId("Mediterranean")],
        },
        "manual"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBe("IT");
      expect(recipe?.originRegion).toBe("Lazio");
      expect(recipe?.provenanceNote).toBe("Una classica ricetta romana.");
      expect(recipe?.cuisines.map((cuisine) => cuisine.name)).toEqual(["Italian", "Mediterranean"]);
    });

    it("replaces the whole group, clearing omitted fields and dropped Cuisines", async () => {
      await replaceRecipeProvenance(
        testRecipe.id,
        {
          originCountry: "IT",
          originRegion: "Lazio",
          provenanceNote: "First claim.",
          cuisineIds: [await cuisineId("Italian")],
        },
        "manual"
      );

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "JP", provenanceNote: "Second claim." },
        "manual"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBe("JP");
      expect(recipe?.originRegion).toBeNull();
      expect(recipe?.cuisines).toEqual([]);
    });

    it("normalizes the country to an alpha-2 code and rejects a display name", async () => {
      await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "it", provenanceNote: "Lowercase code." },
        "manual"
      );

      expect((await getRecipeFull(testRecipe.id))?.originCountry).toBe("IT");

      await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "Italy", provenanceNote: "A name, not a code." },
        "manual"
      );

      expect((await getRecipeFull(testRecipe.id))?.originCountry).toBeNull();
    });

    it("rejects an entirely blank proposal without touching stored values", async () => {
      await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "IT", provenanceNote: "Stored." },
        "manual"
      );

      await expect(
        replaceRecipeProvenance(
          testRecipe.id,
          { originCountry: null, originRegion: "  ", provenanceNote: "" },
          "manual"
        )
      ).rejects.toThrow();

      expect((await getRecipeFull(testRecipe.id))?.provenanceNote).toBe("Stored.");
    });

    it("leaves no partial group behind when the join write fails", async () => {
      await expect(
        replaceRecipeProvenance(
          testRecipe.id,
          {
            originCountry: "IT",
            provenanceNote: "Would be stored.",
            cuisineIds: ["00000000-0000-0000-0000-000000000000"],
          },
          "manual"
        )
      ).rejects.toThrow();

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBeNull();
      expect(recipe?.provenanceNote).toBeNull();
    });
  });

  describe("replaceRecipeProvenance with the automatic origin", () => {
    it("applies while the whole group is absent", async () => {
      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "IT", provenanceNote: "Inferred." },
        "automatic"
      );

      expect(applied).toBe(true);
    });

    it.each(["originCountry", "originRegion", "provenanceNote"] as const)(
      "defers to supplied %s that appeared while the request was in flight",
      async (field) => {
        await replaceRecipeProvenance(
          testRecipe.id,
          { [field]: field === "originCountry" ? "NL" : "Set by an editor." },
          "manual"
        );

        const applied = await replaceRecipeProvenance(
          testRecipe.id,
          { originCountry: "IT", provenanceNote: "Inferred." },
          "automatic"
        );

        expect(applied).toBe(false);
        expect((await getRecipeFull(testRecipe.id))?.provenanceNote).not.toBe("Inferred.");
      }
    );

    it("defers to a supplied Cuisine even when every scalar field is absent", async () => {
      const italian = await findCuisineByName("Italian");

      await replaceRecipeProvenance(testRecipe.id, { cuisineIds: [italian!.id] }, "manual");

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "JP", provenanceNote: "Inferred." },
        "automatic"
      );

      expect(applied).toBe(false);
      expect((await getRecipeCuisines(testRecipe.id)).map((c) => c.name)).toEqual(["Italian"]);
    });
  });

  describe("clearRecipeProvenance", () => {
    it("removes the whole group, unlike a run writing an empty result", async () => {
      const italian = await findCuisineByName("Italian");

      await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "IT", provenanceNote: "Wrong.", cuisineIds: [italian!.id] },
        "manual"
      );

      expect(await clearRecipeProvenance(testRecipe.id)).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBeNull();
      expect(recipe?.originRegion).toBeNull();
      expect(recipe?.provenanceNote).toBeNull();
      expect(recipe?.cuisines).toEqual([]);
    });

    it("reports a clear of a recipe that is not there", async () => {
      expect(await clearRecipeProvenance("00000000-0000-0000-0000-000000000000")).toBe(false);
    });
  });
});
