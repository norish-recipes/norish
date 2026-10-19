import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { FilterMode, SortOrder } from "@norish/shared/contracts";
import {
  dashboardRecipe,
  deleteRecipeById,
  getRecipeFull,
  listRecipes,
} from "@norish/db/repositories/recipes";
import { announceUsableRecipe } from "@norish/queue/enrichment/announce";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import {
  createResolvedRecipe,
  updateResolvedRecipe,
} from "@norish/shared-server/ingredients/recipe-lines";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";
import { recipes as recipesRealtime } from "@norish/shared-server/realtime/recipes";
import {
  FullRecipeInsertSchema,
  FullRecipeUpdateSchema,
  RecipeDeleteInputSchema,
  RecipeGetInputSchema,
  RecipeListInputSchema,
  StepStepSchema,
} from "@norish/shared/contracts/zod";

import type { McpCaller } from "../context";
import { conflict } from "../errors";
import { requireRecipe, runTool } from "./helpers";
import { runPostWrite } from "./post-write";

const RecipeCreateInputSchema = FullRecipeInsertSchema.omit({
  id: true,
  image: true,
  images: true,
  videos: true,
  dishColor: true,
})
  .extend({
    steps: z.array(StepStepSchema.omit({ images: true })).default([]),
  })
  .strict();

const RecipeUpdateInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  data: FullRecipeUpdateSchema.omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    version: true,
    dishColor: true,
    image: true,
    images: true,
    videos: true,
  })
    .extend({
      steps: z.array(StepStepSchema.omit({ images: true })).optional(),
    })
    .strict(),
});

export function registerRecipeTools(server: McpServer, caller: McpCaller): void {
  server.registerTool(
    "search_recipes",
    {
      title: "Search recipes",
      description:
        "Search and page through the recipes this user can view. Returns recipe summaries with pagination.",
      inputSchema: RecipeListInputSchema,
      annotations: { readOnlyHint: true },
    },
    (input) =>
      runTool("search_recipes", caller, async () => {
        const result = await listRecipes(
          {
            userId: caller.userId,
            householdUserIds: caller.householdUserIds,
            isServerAdmin: caller.isServerAdmin,
          },
          input.limit,
          input.cursor,
          input.search,
          input.searchFields,
          input.tags,
          input.filterMode as FilterMode,
          input.sortMode as SortOrder,
          input.minRating,
          input.maxCookingTime,
          input.categories
        );

        return {
          recipes: result.recipes,
          total: result.total,
          nextCursor: input.cursor + input.limit < result.total ? input.cursor + input.limit : null,
        };
      })
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get recipe",
      description: "Read one recipe this user can view, including its ingredients and steps.",
      inputSchema: RecipeGetInputSchema,
      annotations: { readOnlyHint: true },
    },
    (input) =>
      runTool("get_recipe", caller, async () => {
        return requireRecipe(caller, input.id, "view");
      })
  );

  server.registerTool(
    "create_recipe",
    {
      title: "Create recipe",
      description:
        "Create a recipe owned by this user. Ingredient lines travel as ingredientName text or a known ingredientId. Images and videos are not accepted.",
      inputSchema: RecipeCreateInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) =>
      runTool("create_recipe", caller, async () => {
        const created = await createResolvedRecipe(randomUUID(), caller.userId, input, {
          userId: caller.userId,
        });

        if (!created) {
          throw new Error("Recipe was not written");
        }

        await runPostWrite(caller.userId, "recipe", created.recipeId, "publish", async () => {
          const dashboard = await dashboardRecipe(created.recipeId);

          if (!dashboard) return;

          const policy = await getRecipePermissionPolicy();

          await recipesRealtime.publish(
            "created",
            { recipe: dashboard },
            { viewPolicy: policy.view, userId: caller.userId, householdKey: caller.householdKey }
          );
        });

        await runPostWrite(caller.userId, "recipe", created.recipeId, "announce", () =>
          announceUsableRecipe(created, {
            userId: caller.userId,
            householdKey: caller.householdKey,
            householdUserIds: caller.householdUserIds,
          })
        );

        return { id: created.recipeId, status: created.status };
      })
  );

  server.registerTool(
    "update_recipe",
    {
      title: "Update recipe",
      description:
        "Update a recipe this user can edit. The version must match the recipe's current version.",
      inputSchema: RecipeUpdateInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) =>
      runTool("update_recipe", caller, async () => {
        await requireRecipe(caller, input.id, "edit");

        const result = await updateResolvedRecipe(
          input.id,
          caller.userId,
          input.data,
          {
            userId: caller.userId,
          },
          input.version
        );

        if (result.stale) {
          throw conflict("The recipe changed since it was read. Read it again and retry.");
        }

        await runPostWrite(caller.userId, "recipe", input.id, "publish", async () => {
          const updated = await getRecipeFull(input.id);

          if (!updated) return;

          const policy = await getRecipePermissionPolicy();

          await recipesRealtime.publish(
            "updated",
            { recipe: updated },
            { viewPolicy: policy.view, userId: caller.userId, householdKey: caller.householdKey }
          );
        });

        return { success: true };
      })
  );

  server.registerTool(
    "delete_recipe",
    {
      title: "Delete recipe",
      description:
        "Delete a recipe this user can delete. The version must match the recipe's current version.",
      inputSchema: RecipeDeleteInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    (input) =>
      runTool("delete_recipe", caller, async () => {
        await requireRecipe(caller, input.id, "delete");

        const result = await deleteRecipeById(input.id, input.version);

        if (result.stale) {
          throw conflict("The recipe changed since it was read. Read it again and retry.");
        }

        await runPostWrite(caller.userId, "recipe", input.id, "cleanup", () =>
          deleteRecipeImagesDir(input.id)
        );

        await runPostWrite(caller.userId, "recipe", input.id, "publish", async () => {
          const policy = await getRecipePermissionPolicy();

          await recipesRealtime.publish(
            "deleted",
            { id: input.id },
            { viewPolicy: policy.view, userId: caller.userId, householdKey: caller.householdKey }
          );
        });

        return { success: true };
      })
  );
}
