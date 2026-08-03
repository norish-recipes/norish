// @vitest-environment node
/**
 * Step Ingredients through the save path and the full-recipe read.
 *
 * The references ride the step payload — the same mechanism step images use —
 * so the editor's recreate-on-save behaviour costs nothing, and the stored
 * form is a real foreign key, so deleting a step or an ingredient line
 * deletes its references with it.
 */

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { FullRecipeDTO, User } from "@norish/shared/contracts";
import {
  createRecipeWithRefs,
  getRecipeFull,
  updateRecipeWithRefs,
} from "@norish/db/repositories/recipes";
import * as schema from "@norish/db/schema";

import { getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("Step Ingredients", () => {
  let user: User;
  let testRecipe: FullRecipeDTO;
  const testBase = new RepositoryTestBase("test_step_ingredients");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    [user, testRecipe] = await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function countStoredRefs(): Promise<number> {
    const db = getTestDb();
    const rows = await db.select().from(schema.stepIngredients);

    return rows.length;
  }

  /** A metric-and-us recipe whose steps carry Step Ingredient references. */
  function dualSystemInsert() {
    return {
      name: "Linked Stew",
      systemUsed: "metric" as const,
      servings: 2,
      recipeIngredients: [
        {
          ingredientName: "water",
          ingredientId: null,
          amount: 50,
          unit: "ml",
          order: 0,
          systemUsed: "metric" as const,
        },
        {
          ingredientName: "flour",
          ingredientId: null,
          amount: 300,
          unit: "g",
          order: 1,
          systemUsed: "metric" as const,
        },
        {
          ingredientName: "water",
          ingredientId: null,
          amount: 0.25,
          unit: "cup",
          order: 0,
          systemUsed: "us" as const,
        },
        {
          ingredientName: "flour",
          ingredientId: null,
          amount: 2.5,
          unit: "cup",
          order: 1,
          systemUsed: "us" as const,
        },
      ],
      steps: [
        {
          step: "Add half the water.",
          order: 0,
          systemUsed: "metric" as const,
          stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
        },
        {
          step: "Mix in the flour and the rest of the water.",
          order: 1,
          systemUsed: "metric" as const,
          stepIngredients: [
            { ingredientOrder: 1, share: 1, order: 0 },
            { ingredientOrder: 0, share: 0.5, order: 1 },
          ],
        },
        {
          step: "Add half the water.",
          order: 0,
          systemUsed: "us" as const,
          stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
        },
      ],
    };
  }

  describe("creation", () => {
    it("stores references riding the step payload and exposes them on the full read", async () => {
      const created = await createRecipeWithRefs(randomUUID(), user.id, dualSystemInsert());

      expect(created?.status).toBe("inserted");

      const recipe = await getRecipeFull(created!.recipeId);
      const metricSteps = recipe!.steps.filter((step) => step.systemUsed === "metric");

      expect(metricSteps[0]?.stepIngredients).toEqual([
        { ingredientOrder: 0, share: 0.5, order: 0 },
      ]);
      expect(metricSteps[1]?.stepIngredients).toEqual([
        { ingredientOrder: 1, share: 1, order: 0 },
        { ingredientOrder: 0, share: 0.5, order: 1 },
      ]);
    });

    it("lands each system's references on that system's own line rows", async () => {
      const created = await createRecipeWithRefs(randomUUID(), user.id, dualSystemInsert());
      const db = getTestDb();

      const rows = await db.execute(sql`
        select ri.system_used as system, ri.amount
          from step_ingredients si
          join steps s on s.id = si.step_id
          join recipe_ingredients ri on ri.id = si.recipe_ingredient_id
         where s.recipe_id = ${created!.recipeId}
           and ri."order" = '0'
      `);
      const bySystem = new Map(
        (rows.rows as { system: string; amount: string }[]).map((row) => [row.system, row.amount])
      );

      // The metric "add half the water" points at 50 ml; the US one at ¼ cup.
      expect(bySystem.get("metric")).toBe("50.000");
      expect(bySystem.get("us")).toBe("0.250");
    });

    it("drops a reference whose line order does not exist rather than failing the save", async () => {
      const input = dualSystemInsert();

      input.steps[0]!.stepIngredients = [{ ingredientOrder: 99, share: 1, order: 0 }];

      const created = await createRecipeWithRefs(randomUUID(), user.id, input);
      const recipe = await getRecipeFull(created!.recipeId);
      const metricSteps = recipe!.steps.filter((step) => step.systemUsed === "metric");

      expect(metricSteps[0]?.stepIngredients).toEqual([]);
    });
  });

  describe("the editor's save round-trip", () => {
    async function createLinked(): Promise<string> {
      const created = await createRecipeWithRefs(randomUUID(), user.id, dualSystemInsert());

      return created!.recipeId;
    }

    it("keeps references that ride the step payload across a positional step rewrite", async () => {
      const recipeId = await createLinked();

      // The editor recreates steps on save; the references ride each step.
      const outcome = await updateRecipeWithRefs(recipeId, user.id, {
        systemUsed: "metric",
        steps: [
          {
            step: "Add half the water, reworded.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
          },
          {
            step: "Mix in the flour.",
            order: 1,
            systemUsed: "metric",
            stepIngredients: [{ ingredientOrder: 1, share: 1, order: 0 }],
          },
        ],
      });

      expect(outcome.applied).toBe(true);

      const recipe = await getRecipeFull(recipeId);
      const metricSteps = recipe!.steps.filter((step) => step.systemUsed === "metric");

      expect(metricSteps[0]?.stepIngredients).toEqual([
        { ingredientOrder: 0, share: 0.5, order: 0 },
      ]);
      expect(metricSteps[1]?.stepIngredients).toEqual([{ ingredientOrder: 1, share: 1, order: 0 }]);
      // The US step kept its reference: the save touched one system only.
      const usSteps = recipe!.steps.filter((step) => step.systemUsed === "us");

      expect(usSteps[0]?.stepIngredients).toEqual([{ ingredientOrder: 0, share: 0.5, order: 0 }]);
    });

    it("treats a step saved without references as unlinked, replacing what it had", async () => {
      const recipeId = await createLinked();

      await updateRecipeWithRefs(recipeId, user.id, {
        systemUsed: "metric",
        steps: [
          { step: "Add half the water.", order: 0, systemUsed: "metric", stepIngredients: [] },
          { step: "Mix in the flour.", order: 1, systemUsed: "metric", stepIngredients: [] },
        ],
      });

      const recipe = await getRecipeFull(recipeId);
      const metricSteps = recipe!.steps.filter((step) => step.systemUsed === "metric");

      expect(metricSteps.every((step) => step.stepIngredients.length === 0)).toBe(true);
    });

    it("leaves references untouched when an ingredient line's amount is edited", async () => {
      const recipeId = await createLinked();
      const before = await getRecipeFull(recipeId);
      const metricLines = before!.recipeIngredients.filter((line) => line.systemUsed === "metric");

      await updateRecipeWithRefs(recipeId, user.id, {
        systemUsed: "metric",
        recipeIngredients: metricLines.map((line) => ({
          id: line.id,
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          amount: line.order === 0 ? 80 : line.amount,
          unit: line.unit,
          order: line.order,
          systemUsed: "metric",
        })),
      });

      const recipe = await getRecipeFull(recipeId);
      const metricSteps = recipe!.steps.filter((step) => step.systemUsed === "metric");

      // The stored reference is untouched; the displayed amount is derived at
      // render time, so it follows the edit without any write here.
      expect(metricSteps[0]?.stepIngredients).toEqual([
        { ingredientOrder: 0, share: 0.5, order: 0 },
      ]);
      expect(
        recipe!.recipeIngredients.find((line) => line.systemUsed === "metric" && line.order === 0)
          ?.amount
      ).toBe(80);
    });
  });

  describe("cascading deletes", () => {
    it("deletes references with their step", async () => {
      const created = await createRecipeWithRefs(randomUUID(), user.id, dualSystemInsert());
      const refsBefore = await countStoredRefs();

      // Save the metric system with only the first step: the surplus tail row
      // is deleted, and its references must go with it.
      await updateRecipeWithRefs(created!.recipeId, user.id, {
        systemUsed: "metric",
        steps: [
          {
            step: "Add half the water.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
          },
        ],
      });

      const refsAfter = await countStoredRefs();

      // The second metric step carried two references; both are gone.
      expect(refsBefore - refsAfter).toBe(2);
    });

    it("deletes references with their ingredient line", async () => {
      const created = await createRecipeWithRefs(randomUUID(), user.id, dualSystemInsert());
      const before = await getRecipeFull(created!.recipeId);
      const metricLines = before!.recipeIngredients.filter((line) => line.systemUsed === "metric");

      // Save the metric lines without "flour": the row is deleted and the
      // reference pointing at it cascades away; the water reference stays.
      await updateRecipeWithRefs(created!.recipeId, user.id, {
        systemUsed: "metric",
        recipeIngredients: metricLines
          .filter((line) => line.order === 0)
          .map((line) => ({
            id: line.id,
            ingredientId: line.ingredientId,
            ingredientName: line.ingredientName,
            amount: line.amount,
            unit: line.unit,
            order: line.order,
            systemUsed: "metric",
          })),
      });

      const recipe = await getRecipeFull(created!.recipeId);
      const metricSteps = recipe!.steps.filter((step) => step.systemUsed === "metric");

      expect(metricSteps[0]?.stepIngredients).toEqual([
        { ingredientOrder: 0, share: 0.5, order: 0 },
      ]);
      expect(metricSteps[1]?.stepIngredients).toEqual([
        { ingredientOrder: 0, share: 0.5, order: 1 },
      ]);
    });

    it("deletes every reference with the recipe", async () => {
      const created = await createRecipeWithRefs(randomUUID(), user.id, dualSystemInsert());
      const db = getTestDb();

      expect(await countStoredRefs()).toBeGreaterThan(0);

      await db.execute(sql`delete from recipes where id = ${created!.recipeId}`);

      expect(await countStoredRefs()).toBe(0);
    });
  });

  describe("an unlinked recipe", () => {
    it("reads with empty reference lists rather than anything new", async () => {
      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.steps.every((step) => step.stepIngredients.length === 0)).toBe(true);
    });
  });
});
