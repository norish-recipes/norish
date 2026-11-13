import { RecipeScreen } from "@/features/recipes/recipe-screen";
import { readRecipeFilters } from "@/lib/recipe-filters-server";

import { DEFAULT_LIBRARY_TYPE_FILTER } from "@norish/shared/contracts";

export default async function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  const [{ id }, filters] = await Promise.all([params, readRecipeFilters()]);

  return (
    <RecipeScreen libraryType={filters?.libraryType ?? DEFAULT_LIBRARY_TYPE_FILTER} recipeId={id} />
  );
}
