import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import {
  allergenSet,
  dedupeTagsByName,
  formatMinutesHM,
  sortTagsWithAllergyPriority,
} from "@norish/shared/lib/helpers";

/** What a Library card states about a recipe: the allergens' tags first, the description, the time and the servings. */
export function recipeCardFacts(
  recipe: Pick<
    RecipeDashboardDTO,
    "tags" | "description" | "totalMinutes" | "prepMinutes" | "cookMinutes" | "servings"
  >,
  allergies: string[]
) {
  const summedMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return {
    description: recipe.description?.trim() ?? "",
    tagNames: sortTagsWithAllergyPriority(dedupeTagsByName(recipe.tags ?? []), allergies).map(
      (tag) => tag.name
    ),
    allergySet: allergenSet(allergies),
    timeLabel: formatMinutesHM(recipe.totalMinutes ?? (summedMinutes || undefined)),
    servings: typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null,
  };
}
