import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import RecipePageDesktop from "@/app/(app)/recipes/[id]/recipe-page-desktop";
import RecipePageMobile from "@/app/(app)/recipes/[id]/recipe-page-mobile";

const userPreferencesState = {
  hidden: ["favorites"] as string[],
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({
    user: { preferences: userPreferencesState },
  }),
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContextRequired: () => ({
    recipe: {
      id: "r1",
      name: "Recipe",
      url: null,
      description: "desc",
      categories: [],
      prepMinutes: 10,
      cookMinutes: 20,
      totalMinutes: 30,
      tags: [],
      author: null,
      notes: null,
      servings: 2,
      systemUsed: null,
    },
    currentServings: 2,
    allergies: [],
    allergySet: new Set<string>(),
  }),
}));

vi.mock("@/hooks/favorites", () => ({
  useFavoritesQuery: () => ({ isFavorite: () => false }),
  useFavoritesMutation: () => ({ toggleFavorite: vi.fn() }),
}));

vi.mock("@/hooks/ratings", () => ({
  useRatingQuery: () => ({ userRating: null, averageRating: null, isLoading: false }),
  useRatingsMutation: () => ({ rateRecipe: vi.fn(), isRating: false }),
}));

vi.mock("@/components/shared/double-tap-container", () => ({
  default: ({ children, disabled, doubleTapEnabled }: any) => (
    <div
      data-disabled={String(Boolean(disabled))}
      data-doubletap-enabled={String(doubleTapEnabled !== false)}
      data-testid="double-tap-container"
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/shared/heart-button", () => ({
  default: () => <div data-testid="heart-button" />,
}));

vi.mock("@norish/ui/star-rating", () => ({
  default: () => <div>star-rating</div>,
}));

vi.mock("@/components/shared/media-carousel", () => ({
  default: () => <div>media-carousel</div>,
  buildMediaItems: () => [],
}));

vi.mock("@/app/(app)/recipes/[id]/components/provenance-card", () => ({
  default: () => <div>provenance-card</div>,
  ProvenanceSection: () => <div>provenance-section</div>,
  useProvenanceSectionVisible: () => true,
}));

vi.mock("@/app/(app)/recipes/[id]/components/nutrition-card", () => ({
  default: () => <div>nutrition-card</div>,
  NutritionSection: () => <div>nutrition-section</div>,
  useNutritionSectionVisible: () => true,
}));

vi.mock("@/app/(app)/recipes/[id]/components/notes-card", () => ({
  default: () => <div>notes-card</div>,
  NotesSection: () => <div>notes-section</div>,
  useNotesSectionVisible: () => false,
}));

vi.mock("@/app/(app)/recipes/[id]/components/actions-menu", () => ({
  default: () => <div>actions-menu</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/add-to-groceries-button", () => ({
  default: () => <div>add-groceries</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/ingredient-list", () => ({
  default: () => <div>ingredients-list</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/servings-control", () => ({
  default: () => <div>servings-control</div>,
}));
vi.mock("@/components/recipes/amount-display-toggle", () => ({
  default: () => <div>amount-toggle</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/cookingmode", () => ({
  default: () => <div>cooking-mode</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/steps-list", () => ({
  default: () => <div>steps-list</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/system-convert-menu", () => ({
  default: () => <div>system-convert-menu</div>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/wake-lock-toggle", () => ({
  default: () => <div>wake-lock-toggle</div>,
}));
vi.mock("@/components/recipes/author-chip", () => ({
  default: () => <div>author-chip</div>,
}));

describe("recipe pages favorite visibility", () => {
  it("keeps tap interactions enabled on desktop when favorites are hidden", () => {
    userPreferencesState.hidden = ["favorites"];

    render(<RecipePageDesktop />);

    expect(screen.getByTestId("double-tap-container")).toHaveAttribute("data-disabled", "false");
    expect(screen.getByTestId("double-tap-container")).toHaveAttribute(
      "data-doubletap-enabled",
      "false"
    );
  });

  it("keeps tap interactions enabled on mobile when favorites are hidden", () => {
    userPreferencesState.hidden = ["favorites"];

    render(<RecipePageMobile />);

    expect(screen.getByTestId("double-tap-container")).toHaveAttribute("data-disabled", "false");
    expect(screen.getByTestId("double-tap-container")).toHaveAttribute(
      "data-doubletap-enabled",
      "false"
    );
  });
});
