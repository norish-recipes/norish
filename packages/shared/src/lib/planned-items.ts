import type { PlannedItemWithRecipePayload } from "../contracts/zod/planned-items";

export function buildPlannedItemPayload(
  item: Pick<
    PlannedItemWithRecipePayload,
    | "id"
    | "date"
    | "slot"
    | "sortOrder"
    | "itemType"
    | "recipeId"
    | "title"
    | "userId"
    | "version"
    | "recipeName"
    | "recipeImage"
    | "servings"
    | "calories"
  >
): PlannedItemWithRecipePayload {
  return {
    id: item.id,
    date: item.date,
    slot: item.slot,
    sortOrder: item.sortOrder,
    itemType: item.itemType,
    recipeId: item.recipeId,
    title: item.title,
    userId: item.userId,
    version: item.version,
    recipeName: item.recipeName,
    recipeImage: item.recipeImage,
    servings: item.servings,
    calories: item.calories,
  };
}
