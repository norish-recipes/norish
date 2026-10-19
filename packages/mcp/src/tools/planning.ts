import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  createPlannedItem,
  getPlannedItemWithRecipeById,
} from "@norish/db/repositories/planned-items";
import { publishCalendarItemEvent } from "@norish/shared-server/realtime/calendar-events";
import { buildPlannedItemPayload } from "@norish/shared/lib/planned-items";

import type { McpCaller } from "../context";
import { requireRecipe, runTool } from "./helpers";
import { runPostWrite } from "./post-write";

const PlanMealInputSchema = z.object({
  recipeId: z.uuid().describe("The recipe to plan."),
  date: z.iso.date().describe("The day to plan it on, in YYYY-MM-DD format."),
  slot: z
    .enum(["Breakfast", "Lunch", "Dinner", "Snack"])
    .describe("The meal the recipe is planned for."),
});

export function registerPlanningTools(server: McpServer, caller: McpCaller): void {
  server.registerTool(
    "plan_meal",
    {
      title: "Plan a meal",
      description:
        "Add a recipe to this user's own meal plan. Viewing the recipe is enough; edit access is not required.",
      inputSchema: PlanMealInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) =>
      runTool("plan_meal", caller, async () => {
        await requireRecipe(caller, input.recipeId, "view");

        const item = await createPlannedItem({
          userId: caller.userId,
          date: input.date,
          slot: input.slot,
          itemType: "recipe",
          recipeId: input.recipeId,
        });

        const followUp = { recipeName: null as string | null, recipeImage: null as string | null };

        const followedUp = await runPostWrite(
          caller.userId,
          "planned-item",
          item.id,
          "publish",
          async () => {
            const withRecipe = await getPlannedItemWithRecipeById(item.id);

            const itemPayload = buildPlannedItemPayload({
              id: item.id,
              date: item.date,
              slot: item.slot,
              sortOrder: item.sortOrder,
              itemType: item.itemType,
              recipeId: item.recipeId,
              title: item.title,
              userId: item.userId,
              version: item.version,
              recipeName: withRecipe?.recipeName ?? null,
              recipeImage: withRecipe?.recipeImage ?? null,
              servings: withRecipe?.servings ?? null,
              calories: withRecipe?.calories ?? null,
            });

            await publishCalendarItemEvent(
              "itemCreated",
              { item: itemPayload },
              caller.householdKey
            );

            followUp.recipeName = withRecipe?.recipeName ?? null;
            followUp.recipeImage = withRecipe?.recipeImage ?? null;
          }
        );

        return {
          id: item.id,
          date: item.date,
          slot: item.slot,
          recipeId: input.recipeId,
          recipeName: followedUp ? followUp.recipeName : null,
          recipeImage: followedUp ? followUp.recipeImage : null,
        };
      })
  );
}
