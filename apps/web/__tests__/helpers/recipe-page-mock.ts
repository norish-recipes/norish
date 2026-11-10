import { vi } from "vitest";

import type { RecipePageState } from "@norish/shared-react/recipes";
import type { MeasurementSystem } from "@norish/shared/contracts";

export type MockRecipePage = {
  /** The page's recipe; only the fields a test's component reads. */
  recipe: object | null;
  /** The ingredients at the servings shown; the recipe's own lines by default. */
  ingredients?: unknown[];
  /** The servings shown; the recipe's own by default. */
  servings?: number;
  convertingTo?: MeasurementSystem | null;
  startConversion?: (target: MeasurementSystem, withAI?: boolean) => void;
  setServings?: (servings: number) => void;
  /** Whether the server's copy is on its way. */
  isFetching?: boolean;
  /** The cookbooks the recipe is filed into; none by default. */
  cookbooks?: { id: string; title: string }[];
};

/**
 * `@norish/shared-react/recipes` with the recipe page's store and reads over the test's own
 * state, for a `vi.mock` without a query cache or a provider: `read` runs on every render.
 */
export async function mockRecipePage(read: () => MockRecipePage) {
  const actual = await vi.importActual<typeof import("@norish/shared-react/recipes")>(
    "@norish/shared-react/recipes"
  );
  const recipe = () => read().recipe as { id?: string; servings?: number; recipeIngredients?: [] };
  const state = (): Partial<RecipePageState> => ({
    recipeId: recipe()?.id ?? "recipe-1",
    servings: read().servings ?? null,
    conversion: null,
    wakeLock: false,
    setServings: read().setServings ?? vi.fn(),
  });

  return {
    ...actual,
    usePageRecipe: () => read().recipe,
    useLoadedPageRecipe: () => read().recipe,
    usePageServings: () => read().servings ?? recipe()?.servings ?? 1,
    usePageIngredients: () => read().ingredients ?? recipe()?.recipeIngredients ?? [],
    useRecipePageStore: <T>(selector: (state: RecipePageState) => T) =>
      selector(state() as RecipePageState),
    useRecipeQuery: () => ({
      recipe: read().recipe,
      isLoading: false,
      isFetching: read().isFetching ?? false,
      error: null,
    }),
    useRecipeCookbooksQuery: () => ({ cookbooks: read().cookbooks ?? [], isLoading: false }),
    // The page's heart and stars, quiet unless a test overrides them.
    useFavoritesQuery: () => ({ isFavorite: () => false }),
    useFavoritesMutation: () => ({ toggleFavorite: vi.fn() }),
    useRatingQuery: () => ({ userRating: null, averageRating: null, isLoading: false }),
    useRatingsMutation: () => ({ rateRecipe: vi.fn(), isRating: false }),
    useRecipeConversion: () => ({
      convertingTo: read().convertingTo ?? null,
      startConversion: read().startConversion ?? vi.fn(),
    }),
  };
}
