import type { RecipeCardItem } from "./recipe-card.types";

export type RecipeListRow =
  | { id: string; type: "recipe"; recipe: RecipeCardItem }
  | { id: string; type: "initial-skeleton" }
  | { id: string; type: "pending-import" };

type BuildRecipeListRowsOptions = {
  recipes: RecipeCardItem[];
  isLoading: boolean;
  isValidating?: boolean;
  pendingCount: number;
  recipePrefix: string;
  initialSkeletonPrefix: string;
  pendingImportPrefix: string;
};

export function buildRecipeListRows({
  recipes,
  isLoading,
  isValidating = false,
  pendingCount,
  recipePrefix,
  initialSkeletonPrefix,
  pendingImportPrefix,
}: BuildRecipeListRowsOptions): RecipeListRow[] {
  if ((isLoading || isValidating) && recipes.length === 0) {
    return Array.from({ length: 4 }, (_, index) => ({
      id: `${initialSkeletonPrefix}-${index}`,
      type: "initial-skeleton" as const,
    }));
  }

  const recipeRows: RecipeListRow[] = recipes.map((recipe) => ({
    id: `${recipePrefix}-${recipe.id}`,
    type: "recipe",
    recipe,
  }));

  const pendingRows: RecipeListRow[] = Array.from({ length: pendingCount }, (_, index) => ({
    id: `${pendingImportPrefix}-${index}`,
    type: "pending-import",
  }));

  return [...pendingRows, ...recipeRows];
}
