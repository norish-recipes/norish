// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Kids = { children?: ReactNode };

vi.mock("react-native", () => ({
  View: ({ children }: Kids) => <div>{children}</div>,
  Text: ({ children }: Kids) => <span>{children}</span>,
}));
vi.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: Kids) => children,
  useTapGesture: () => ({}),
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/components/card-photo", () => ({ CardPhoto: () => null }));
vi.mock("@/components/highlighted-text", () => ({ HighlightedText: () => null }));
vi.mock("@/components/pill", () => ({ Pill: () => null }));
vi.mock("@/components/press-tap", () => ({ PressTap: ({ children }: Kids) => children }));
vi.mock("@/lib/haptics", () => ({ lightImpact: () => {} }));
vi.mock("@/lib/tab-routes", () => ({ recipeRoute: () => "/" }));
vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ navigation: { toRecipe: () => {} } }),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  recipeCardFacts: (recipe: { description: string }) => ({
    description: recipe.description,
    tagNames: [],
    allergySet: new Set(),
    timeLabel: "",
    servings: "",
  }),
}));
vi.mock("@/features/recipes/hooks/use-card-action-menu", () => ({
  useCardActionMenu: () => ({ items: [], accessibilityProps: {} }),
}));
vi.mock("@/features/recipes/utils/card-actions", () => ({
  RECIPE_ACTION_DEFINITIONS: {},
  recipeMenuActions: () => [],
  recipeSwipeActions: () => [],
}));
vi.mock("@/features/recipes/components/card-menu", () => ({
  CardMenu: ({ children }: Kids) => children,
}));
vi.mock("@/features/recipes/components/favourite-mark", () => ({ FavouriteMark: () => null }));
vi.mock("@/features/recipes/components/match-text", () => ({ MatchText: () => null }));
vi.mock("@/features/recipes/components/swipe-actions", () => ({
  SwipeActions: ({ children }: Kids) => children,
}));
vi.mock("@/features/recipes/components/tag-chips", () => ({ TAG_GAP: 4, TagChips: () => null }));

const { RecipeCard } = await import("@/features/recipes/components/recipe-card");

const actions = { canDelete: () => false, canRemoveFromCookbook: false } as never;

describe("RecipeCard description", () => {
  it.each(["list", "grid"] as const)("shows it as plain text on the %s card", (variant) => {
    const recipe = {
      id: "r1",
      name: "Pasta",
      image: null,
      description: "**Quick** [weeknight](https://x.test) dinner",
    } as never;

    render(
      <RecipeCard
        actions={actions}
        allergies={[]}
        isFavorite={false}
        recipe={recipe}
        variant={variant}
      />
    );

    expect(screen.getByText("Quick weeknight dinner")).toBeTruthy();
  });
});
