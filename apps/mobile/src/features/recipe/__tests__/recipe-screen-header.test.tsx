// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Options = { unstable_headerRightItems?: () => unknown[] };

const held = vi.hoisted(() => ({
  state: "not-found" as string,
  recipe: null as { id: string } | null,
  options: [] as Options[],
}));

vi.mock("react-native", () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("expo-router", () => ({
  Stack: { Screen: ({ options }: { options: Options }) => (held.options.push(options), null) },
  useLocalSearchParams: () => ({ id: "recipe-1" }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock("heroui-native", () => ({ Skeleton: () => null, useThemeColor: (n: string[]) => n }));
vi.mock("@/components/empty-card", () => ({ EmptyCard: () => null }));
vi.mock("@/hooks/use-resolved-color-scheme", () => ({ useResolvedColorScheme: () => "light" }));
vi.mock("@/lib/home-indicator", () => ({ homeIndicator: 0 }));
vi.mock("@/lib/i18n/use-text", () => ({ useText: () => (id: string) => id }));
vi.mock("@/lib/tab-bar-placement", () => ({ tabListBottomInset: () => 0 }));
vi.mock("@norish/shared-react/reader", () => ({
  useDevicePreference: () => ["theme"],
  useHiddenItemVisibility: () => ({ showFavorites: true }),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  LoadedPageRecipe: ({ children }: { children?: ReactNode }) => children,
  useAutoConversion: () => {},
  useFavoritesMutation: () => ({ toggleFavorite: vi.fn() }),
  useLoadedPageRecipe: () => ({ id: "recipe-1", recipeIngredients: [], dishColor: null }),
  useRecipeQuery: () => ({ recipe: held.recipe, state: held.state, retry: vi.fn() }),
}));
vi.mock("../hooks/use-recipe-menu", () => ({ useRecipeHeaderItems: () => ["favourite", "menu"] }));
vi.mock("../components/recipe-not-found", () => ({ RecipeNotFound: () => null }));
vi.mock("../components/cookbooks-section", () => ({ CookbooksSection: () => null }));
vi.mock("../components/ingredient-icon-prefetch", () => ({ PrefetchIngredientIcons: () => null }));
vi.mock("../components/ingredients-section", () => ({ IngredientsSection: () => null }));
vi.mock("../components/notes-section", () => ({ NotesSection: () => null }));
vi.mock("../components/nutrition-section", () => ({ NutritionSection: () => null }));
vi.mock("../components/provenance-section", () => ({ ProvenanceSection: () => null }));
vi.mock("../components/rating-section", () => ({ RatingSection: () => null }));
vi.mock("../components/recipe-header", () => ({ RecipeHeader: () => null }));
vi.mock("../components/source-section", () => ({ SourceSection: () => null }));
vi.mock("../components/steps-section", () => ({ StepsSection: () => null }));
vi.mock("../components/recipe-hero", () => ({ HERO_HEIGHT: 0, RecipeHero: () => null }));
vi.mock("../components/tint", () => ({
  TintContext: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("../utils/dish-tint", () => ({ dishTint: () => null }));

const { RecipeScreen } = await import("../screens/recipe-screen");

const rightItems = () =>
  held.options
    .filter((each) => each.unstable_headerRightItems)
    .at(-1)
    ?.unstable_headerRightItems?.();

describe("RecipeScreen's header", () => {
  beforeEach(() => {
    held.options = [];
  });

  it("offers the recipe's actions on a shown recipe", () => {
    held.state = "ready";
    held.recipe = { id: "recipe-1" };
    render(<RecipeScreen />);
    expect(rightItems()).toEqual(["favourite", "menu"]);
  });

  it("clears the actions a recipe left behind once it is not found", () => {
    held.state = "ready";
    held.recipe = { id: "recipe-1" };
    const page = render(<RecipeScreen />);

    held.state = "not-found";
    held.recipe = null;
    page.rerender(<RecipeScreen />);
    expect(rightItems()).toEqual([]);
  });
});
