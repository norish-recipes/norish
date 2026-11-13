import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import { formatMinutesHM, sortTagsWithAllergyPriority } from "@norish/shared/lib/helpers";

/** What a Library card states about a recipe: the allergens' tags first, the time and the servings. */
export function recipeCardFacts(
  recipe: Pick<
    RecipeDashboardDTO,
    "tags" | "totalMinutes" | "prepMinutes" | "cookMinutes" | "servings"
  >,
  allergies: string[]
) {
  const seen = new Set<string>();
  const names: { name: string }[] = [];

  for (const tag of recipe.tags ?? []) {
    const name = tag?.name?.trim();

    if (!name || seen.has(name.toLowerCase())) continue;

    seen.add(name.toLowerCase());
    names.push({ name });
  }

  const summedMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return {
    tagNames: sortTagsWithAllergyPriority(names, allergies).map((tag) => tag.name),
    allergySet: new Set(allergies.map((allergy) => allergy.toLowerCase())),
    timeLabel: formatMinutesHM(recipe.totalMinutes ?? (summedMinutes || undefined)),
    servings: typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null,
  };
}
