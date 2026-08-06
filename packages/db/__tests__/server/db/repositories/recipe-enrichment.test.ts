// @vitest-environment node

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { findCuisineByName, getRecipeCuisines } from "@norish/db/repositories/cuisines";
import {
  addStepIngredientsToBareSteps,
  replaceRecipeCategories,
  replaceRecipeNutrition,
  replaceRecipeProvenance,
} from "@norish/db/repositories/recipe-enrichment";
import {
  createRecipeWithRefs,
  getRecipeFull,
  updateRecipeWithRefs,
} from "@norish/db/repositories/recipes";
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
    it("replaces the whole group atomically", async () => {
      await replaceRecipeNutrition(
        testRecipe.id,
        { calories: 500, fat: "20", carbs: "40", protein: "30" },
        "manual"
      );

      const applied = await replaceRecipeNutrition(
        testRecipe.id,
        { calories: 240, fat: "9", carbs: "30", protein: "12" },
        "manual"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.calories).toBe(240);
      expect(recipe?.fat).toBe("9.00");
      expect(recipe?.carbs).toBe("30.00");
      expect(recipe?.protein).toBe("12.00");
    });

    it("accepts zeros as values", async () => {
      const applied = await replaceRecipeNutrition(
        testRecipe.id,
        { calories: 4, fat: "0", carbs: "1", protein: "0" },
        "manual"
      );

      expect(applied).toBe(true);
      expect((await getRecipeFull(testRecipe.id))?.fat).toBe("0.00");
    });

    it("rejects an incomplete proposal without touching stored values", async () => {
      await replaceRecipeNutrition(
        testRecipe.id,
        { calories: 500, fat: "20", carbs: "40", protein: "30" },
        "manual"
      );

      // Replacement writes all four fields, so a proposal missing any of them
      // would null out the rest and must be refused outright.
      await expect(
        replaceRecipeNutrition(testRecipe.id, { calories: 240 }, "manual")
      ).rejects.toThrow();
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

    it("completes a partially supplied group, replacing it wholesale", async () => {
      const supplied = await createTestRecipe(userId, { name: "Supplied protein", protein: "31" });

      const applied = await replaceRecipeNutrition(
        supplied.id,
        { calories: 240, fat: "9", carbs: "30", protein: "12" },
        "automatic"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(supplied.id);

      expect(recipe?.protein).toBe("12.00");
      expect(recipe?.calories).toBe(240);
    });

    it("becomes a no-op when the stored group is already complete", async () => {
      const supplied = await createTestRecipe(userId, {
        name: "Fully supplied",
        calories: 350,
        fat: "10",
        carbs: "45",
        protein: "31",
      });

      const applied = await replaceRecipeNutrition(
        supplied.id,
        { calories: 240, fat: "9", carbs: "30", protein: "12" },
        "automatic"
      );

      expect(applied).toBe(false);
      expect((await getRecipeFull(supplied.id))?.calories).toBe(350);
    });
  });

  async function cuisineId(name: string): Promise<string> {
    const cuisine = await findCuisineByName(name);

    if (!cuisine) throw new Error(`Seeded Cuisine missing: ${name}`);

    return cuisine.id;
  }

  describe("replaceRecipeProvenance", () => {
    it("writes the scalar fields, the note, and the join rows in one operation", async () => {
      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        {
          originCountry: "IT",
          originCountryName: "Italia",
          originRegion: "Lazio",
          provenanceNote: "Una classica ricetta romana.",
          cuisineIds: [await cuisineId("Italian"), await cuisineId("Mediterranean")],
        },
        "manual"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBe("IT");
      expect(recipe?.originCountryName).toBe("Italia");
      expect(recipe?.originRegion).toBe("Lazio");
      expect(recipe?.provenanceNote).toBe("Una classica ricetta romana.");
      expect(recipe?.cuisines.map((cuisine) => cuisine.name)).toEqual(["Italian", "Mediterranean"]);
    });

    it("replaces the written name with the group, and clears one that is not renewed", async () => {
      await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "IT", originCountryName: "Italia", provenanceNote: "First claim." },
        "manual"
      );

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "JP", provenanceNote: "Second claim." },
        "manual"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      // A stale name must never sit beside a new code: rows with a code and
      // no name fall back to the endonym at render time instead.
      expect(recipe?.originCountry).toBe("JP");
      expect(recipe?.originCountryName).toBeNull();
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
    /** The claim as the worker delivers it: complete, arguing for Italy. */
    async function italianClaim() {
      return {
        originCountry: "IT",
        originCountryName: "Italia",
        originRegion: "Lazio",
        provenanceNote: "Una classica ricetta romana.",
        cuisineIds: [await cuisineId("Italian")],
      };
    }

    it("applies while the whole group is absent", async () => {
      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "IT", provenanceNote: "Inferred." },
        "automatic"
      );

      expect(applied).toBe(true);
    });

    it("fills the scalars around a supplied Cuisine and keeps the Cuisine set", async () => {
      // The gap-fill headline (ADR-0018): one supplied Cuisine used to
      // suppress the whole group; now everything else still gets filled in.
      await replaceRecipeProvenance(
        testRecipe.id,
        { cuisineIds: [await cuisineId("Mediterranean")] },
        "manual"
      );

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        await italianClaim(),
        "automatic"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBe("IT");
      expect(recipe?.originCountryName).toBe("Italia");
      expect(recipe?.originRegion).toBe("Lazio");
      expect(recipe?.provenanceNote).toBe("Una classica ricetta romana.");
      // The supplied set, not the claim's: Cuisines fill only when absent.
      expect(recipe?.cuisines.map((cuisine) => cuisine.name)).toEqual(["Mediterranean"]);
    });

    it("keeps a supplied note and fills the country, region, and Cuisines around it", async () => {
      await replaceRecipeProvenance(
        testRecipe.id,
        { provenanceNote: "My grandmother's, from Rome." },
        "manual"
      );

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        await italianClaim(),
        "automatic"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.provenanceNote).toBe("My grandmother's, from Rome.");
      expect(recipe?.originCountry).toBe("IT");
      expect(recipe?.originRegion).toBe("Lazio");
      expect(recipe?.cuisines.map((cuisine) => cuisine.name)).toEqual(["Italian"]);
    });

    it("refuses claim scalars beside a supplied country the claim argues against", async () => {
      // The claim's note and region argue for Italy. Beside a supplied NL they
      // would contradict the field next to them, so only the Cuisines fill.
      await updateRecipeWithRefs(testRecipe.id, userId, { originCountry: "NL" });

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        await italianClaim(),
        "automatic"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBe("NL");
      expect(recipe?.originCountryName).toBeNull();
      expect(recipe?.originRegion).toBeNull();
      expect(recipe?.provenanceNote).toBeNull();
      expect(recipe?.cuisines.map((cuisine) => cuisine.name)).toEqual(["Italian"]);
    });

    it("completes a supplied country the claim agrees with", async () => {
      await updateRecipeWithRefs(testRecipe.id, userId, { originCountry: "IT" });

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        await italianClaim(),
        "automatic"
      );

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBe("IT");
      // The written name is backfilled beside the code the claim agrees with.
      expect(recipe?.originCountryName).toBe("Italia");
      expect(recipe?.originRegion).toBe("Lazio");
      expect(recipe?.provenanceNote).toBe("Una classica ricetta romana.");
    });

    it("defers entirely to a group completed while the request was in flight", async () => {
      await replaceRecipeProvenance(
        testRecipe.id,
        {
          originCountry: "NL",
          provenanceNote: "Set by an editor.",
          cuisineIds: [await cuisineId("French")],
        },
        "manual"
      );

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        await italianClaim(),
        "automatic"
      );

      expect(applied).toBe(false);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.provenanceNote).toBe("Set by an editor.");
      // A complete group gains nothing, not even the region it never had.
      expect(recipe?.originRegion).toBeNull();
      expect(recipe?.cuisines.map((cuisine) => cuisine.name)).toEqual(["French"]);
    });

    it("defers when a disagreeing claim has nothing else to offer", async () => {
      await updateRecipeWithRefs(testRecipe.id, userId, { originCountry: "NL" });

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "IT", provenanceNote: "Inferred." },
        "automatic"
      );

      expect(applied).toBe(false);
      expect((await getRecipeFull(testRecipe.id))?.provenanceNote).toBeNull();
    });

    it("leaves the stored gaps untouched when the fill's Cuisine write fails", async () => {
      const applied = replaceRecipeProvenance(
        testRecipe.id,
        {
          originCountry: "IT",
          provenanceNote: "Would be stored.",
          cuisineIds: ["00000000-0000-0000-0000-000000000000"],
        },
        "automatic"
      );

      await expect(applied).rejects.toThrow();

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBeNull();
      expect(recipe?.provenanceNote).toBeNull();
    });
  });

  describe("an editor saving the recipe form", () => {
    it("writes the whole group, and its Cuisines by id", async () => {
      const italian = await findCuisineByName("Italian");

      await updateRecipeWithRefs(testRecipe.id, userId, {
        originCountry: "IT",
        originCountryName: "Italië",
        originRegion: "Lazio",
        provenanceNote: "My grandmother's, from Rome.",
        cuisines: [italian!.id],
      });

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBe("IT");
      // The label the editor saw in the picker, in their own words.
      expect(recipe?.originCountryName).toBe("Italië");
      expect(recipe?.originRegion).toBe("Lazio");
      expect(recipe?.provenanceNote).toBe("My grandmother's, from Rome.");
      expect(recipe?.cuisines.map((cuisine) => cuisine.name)).toEqual(["Italian"]);
    });

    it("clears a stored written name when the country is cleared", async () => {
      await updateRecipeWithRefs(testRecipe.id, userId, {
        originCountry: "IT",
        originCountryName: "Italia",
        provenanceNote: "Stored.",
      });

      await updateRecipeWithRefs(testRecipe.id, userId, {
        originCountry: null,
        originCountryName: null,
        provenanceNote: "Stored.",
      });

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBeNull();
      expect(recipe?.originCountryName).toBeNull();
    });

    it("keeps the Cuisines chosen while creating the recipe", async () => {
      const italian = await findCuisineByName("Italian");
      const created = await createRecipeWithRefs(randomUUID(), userId, {
        name: "Created with provenance",
        systemUsed: "metric",
        originCountry: "IT",
        provenanceNote: "Typed in at creation.",
        cuisines: [italian!.id],
      });

      const recipe = await getRecipeFull(created!.recipeId);

      expect(recipe?.originCountry).toBe("IT");
      expect(recipe?.cuisines.map((cuisine) => cuisine.name)).toEqual(["Italian"]);
    });

    it("normalizes a country the editor typed as a name away", async () => {
      await updateRecipeWithRefs(testRecipe.id, userId, { originCountry: "Italy" });

      expect((await getRecipeFull(testRecipe.id))?.originCountry).toBeNull();
    });

    it("survives an automatic run afterwards, because it is supplied data", async () => {
      await updateRecipeWithRefs(testRecipe.id, userId, {
        originCountry: "NL",
        provenanceNote: "Set by an editor.",
      });

      const applied = await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "IT", provenanceNote: "Inferred." },
        "automatic"
      );

      expect(applied).toBe(false);
      expect((await getRecipeFull(testRecipe.id))?.provenanceNote).toBe("Set by an editor.");
    });

    it("clears the group when the editor empties every field", async () => {
      const italian = await findCuisineByName("Italian");

      await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "IT", provenanceNote: "Wrong.", cuisineIds: [italian!.id] },
        "manual"
      );

      await updateRecipeWithRefs(testRecipe.id, userId, {
        originCountry: null,
        originRegion: null,
        provenanceNote: null,
        cuisines: [],
      });

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.originCountry).toBeNull();
      expect(recipe?.provenanceNote).toBeNull();
      expect(recipe?.cuisines).toEqual([]);
    });

    it("leaves provenance alone when the editor changed something else", async () => {
      await replaceRecipeProvenance(
        testRecipe.id,
        { originCountry: "IT", provenanceNote: "Keep me." },
        "manual"
      );

      await updateRecipeWithRefs(testRecipe.id, userId, { name: "A new title" });

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.name).toBe("A new title");
      expect(recipe?.provenanceNote).toBe("Keep me.");
    });
  });

  describe("addStepIngredientsToBareSteps", () => {
    /** Dual-system recipe with a heading row and a hand-linked step. */
    async function createLinkedFixture() {
      const created = await createRecipeWithRefs(randomUUID(), userId, {
        name: "Gap Fill Stew",
        systemUsed: "metric",
        servings: 2,
        recipeIngredients: [
          {
            ingredientName: "# Spices",
            ingredientId: null,
            amount: null,
            unit: null,
            order: 0,
            systemUsed: "metric",
          },
          {
            ingredientName: "salt",
            ingredientId: null,
            amount: 5,
            unit: "g",
            order: 1,
            systemUsed: "metric",
          },
          {
            ingredientName: "water",
            ingredientId: null,
            amount: 50,
            unit: "ml",
            order: 2,
            systemUsed: "metric",
          },
          {
            ingredientName: "salt",
            ingredientId: null,
            amount: 0.2,
            unit: "tsp",
            order: 1,
            systemUsed: "us",
          },
          {
            ingredientName: "water",
            ingredientId: null,
            amount: 0.25,
            unit: "cup",
            order: 2,
            systemUsed: "us",
          },
        ],
        steps: [
          { step: "# Cooking", order: 0, systemUsed: "metric" },
          {
            step: "Season with the salt.",
            order: 1,
            systemUsed: "metric",
            stepIngredients: [{ ingredientOrder: 1, share: 1, order: 0 }],
          },
          { step: "Add half the water.", order: 2, systemUsed: "metric" },
          {
            step: "Season with the salt.",
            order: 1,
            systemUsed: "us",
            stepIngredients: [{ ingredientOrder: 1, share: 1, order: 0 }],
          },
          { step: "Add half the water.", order: 2, systemUsed: "us" },
        ],
      });

      return created!.recipeId;
    }

    it("fills bare steps in every measurement system and leaves linked steps untouched", async () => {
      const recipeId = await createLinkedFixture();

      const written = await addStepIngredientsToBareSteps(recipeId, [
        // The claim also names the already-linked step: the write must skip it.
        { stepOrder: 1, refs: [{ ingredientOrder: 2, share: 1, order: 0 }] },
        { stepOrder: 2, refs: [{ ingredientOrder: 2, share: 0.5, order: 0 }] },
      ]);

      // The bare "half the water" step, once per system.
      expect(written).toBe(2);

      const recipe = await getRecipeFull(recipeId);
      const metric = recipe!.steps.filter((step) => step.systemUsed === "metric");
      const us = recipe!.steps.filter((step) => step.systemUsed === "us");

      // A person's own link is exactly as they left it, not replaced.
      expect(metric[1]?.stepIngredients).toEqual([{ ingredientOrder: 1, share: 1, order: 0 }]);
      expect(metric[2]?.stepIngredients).toEqual([{ ingredientOrder: 2, share: 0.5, order: 0 }]);
      // The us system has no heading row, so its array is one shorter.
      expect(us[0]?.stepIngredients).toEqual([{ ingredientOrder: 1, share: 1, order: 0 }]);
      expect(us[1]?.stepIngredients).toEqual([{ ingredientOrder: 2, share: 0.5, order: 0 }]);
    });

    it("never links heading rows on either side of the reference", async () => {
      const recipeId = await createLinkedFixture();

      const written = await addStepIngredientsToBareSteps(recipeId, [
        // Step order 0 is a heading row; line order 0 is the "# Spices" row.
        { stepOrder: 0, refs: [{ ingredientOrder: 1, share: 1, order: 0 }] },
        { stepOrder: 2, refs: [{ ingredientOrder: 0, share: 1, order: 0 }] },
      ]);

      expect(written).toBe(0);
    });

    it("drops references to line orders that do not exist", async () => {
      const recipeId = await createLinkedFixture();

      const written = await addStepIngredientsToBareSteps(recipeId, [
        { stepOrder: 2, refs: [{ ingredientOrder: 99, share: 1, order: 0 }] },
      ]);

      expect(written).toBe(0);

      const recipe = await getRecipeFull(recipeId);
      const metric = recipe!.steps.filter((step) => step.systemUsed === "metric");

      expect(metric[2]?.stepIngredients).toEqual([]);
    });

    it("writes nothing for an empty claim", async () => {
      const recipeId = await createLinkedFixture();

      expect(await addStepIngredientsToBareSteps(recipeId, [])).toBe(0);
    });
  });
});
