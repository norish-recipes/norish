import { forwardRef } from "react";
import RecipeCard from "@/components/dashboard/recipe-card";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ canDeleteRecipe: () => true }),
}));

vi.mock("@/hooks/recipes/use-recipe-prefetch", () => ({
  useRecipePrefetch: () => ({ current: null }),
}));

vi.mock("@/hooks/user/use-hidden-item-visibility", () => ({
  useHiddenItemVisibility: () => ({ showRatings: true, showFavorites: true }),
}));

vi.mock("@/stores/useAppStore", () => ({
  useAppStore: (selector: (state: { mobileSearchOpen: boolean }) => unknown) =>
    selector({ mobileSearchOpen: false }),
}));

vi.mock("@/components/Panel/consumers", () => ({
  MiniCalendar: () => null,
  MiniGroceries: () => null,
}));

vi.mock("@/components/recipes/origin-flag", () => ({ default: () => null }));
vi.mock("@/components/shared/heart-button", () => ({ default: () => null }));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("@/components/dashboard/recipe-metadata", () => ({ default: () => null }));
vi.mock("@/components/dashboard/recipe-tags", () => ({ default: () => null }));

vi.mock("../shared/delete-recipe-modal", () => ({ DeleteRecipeModal: () => null }));
vi.mock("@/components/shared/delete-recipe-modal", () => ({ DeleteRecipeModal: () => null }));
vi.mock("@/components/shared/double-tap-container", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/shared/swipable-row", () => ({
  default: forwardRef(function SwipeableRowMock(
    { children }: { children?: React.ReactNode },
    _ref: React.Ref<unknown>
  ) {
    return <div>{children}</div>;
  }),
}));

vi.mock("@heroui/react", () => {
  const Chip = ({ children, className, color, variant }: any) => (
    <span
      className={className}
      data-color={color ?? ""}
      data-testid="chip"
      data-variant={variant ?? ""}
    >
      {children}
    </span>
  );

  Chip.Label = ({ children }: any) => <span>{children}</span>;

  const Card = ({ children }: any) => <div>{children}</div>;

  Card.Content = ({ children }: any) => <div>{children}</div>;

  const Tooltip = ({ children }: any) => <div>{children}</div>;

  Tooltip.Trigger = ({ children, "aria-label": ariaLabel }: any) => (
    <span aria-label={ariaLabel}>{children}</span>
  );
  Tooltip.Content = ({ children }: any) => <div data-testid="tooltip-content">{children}</div>;

  return {
    Chip,
    Card,
    Tooltip,
    Button: ({ children, onPress, ...props }: any) => (
      <button type="button" onClick={onPress} {...props}>
        {children}
      </button>
    ),
    useOverlayState: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
  };
});

function makeRecipe(tagNames: string[]): RecipeDashboardDTO {
  return {
    id: "recipe-1",
    userId: "user-1",
    name: "Pasta carbonara",
    description: null,
    notes: null,
    url: null,
    image: null,
    servings: 0,
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    calories: null,
    originCountry: null,
    categories: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    tags: tagNames.map((name) => ({ name, version: 1 })),
    averageRating: null,
    ratingCount: 0,
  } as RecipeDashboardDTO;
}

function renderListCard(tagNames: string[], allergies: string[]) {
  return render(
    <RecipeCard
      allergies={allergies}
      isFavorite={false}
      recipe={makeRecipe(tagNames)}
      variant="list"
      onDelete={vi.fn()}
      onToggleFavorite={vi.fn()}
    />
  );
}

function visibleChips() {
  return screen
    .getAllByTestId("chip")
    .filter((chip) => !chip.closest('[data-testid="tooltip-content"]'));
}

function tagTooltip() {
  const withChips = screen
    .getAllByTestId("tooltip-content")
    .filter((tooltip) => within(tooltip).queryAllByTestId("chip").length > 0);

  expect(withChips).toHaveLength(1);

  return withChips[0];
}

describe("RecipeCard list view allergy tags", () => {
  it("sorts allergen tags first and marks them as warnings", () => {
    renderListCard(["pasta", "dinner", "Lactose"], ["lactose"]);

    const chips = visibleChips();
    const texts = chips.map((c) => c.textContent);

    // Allergen leads even though it is stored last; "dinner" overflows into +1.
    expect(texts).toEqual(["Lactose", "pasta", "+1"]);
    expect(chips[0]).toHaveAttribute("data-color", "warning");
    expect(chips[0]).toHaveAttribute("data-variant", "primary");
    expect(chips[1]).toHaveAttribute("data-color", "");
    expect(chips[1]).toHaveAttribute("data-variant", "tertiary");
    expect(chips[2]).toHaveAttribute("data-color", "");
  });

  it("keeps the overflow chip neutral when no allergen is hidden", () => {
    renderListCard(["pasta", "dinner", "easy"], []);

    const chips = visibleChips();

    expect(chips.map((c) => c.textContent)).toEqual(["pasta", "dinner", "+1"]);

    for (const chip of chips) {
      expect(chip).toHaveAttribute("data-color", "");
      expect(chip).toHaveAttribute("data-variant", "tertiary");
    }
  });

  it("carries the warning onto the overflow chip when allergens do not fit", () => {
    renderListCard(["Lactose", "Noten", "Gluten", "pasta"], ["lactose", "noten", "gluten"]);

    const chips = visibleChips();

    expect(chips.map((c) => c.textContent)).toEqual(["Lactose", "Noten", "+2"]);
    expect(chips[2]).toHaveAttribute("data-color", "warning");
    expect(chips[2]).toHaveAttribute("data-variant", "primary");

    // The tooltip lists every tag, allergens first and marked.
    const tooltipChips = within(tagTooltip()).getAllByTestId("chip");

    expect(tooltipChips.map((c) => c.textContent)).toEqual(["Lactose", "Noten", "Gluten", "pasta"]);
    expect(tooltipChips[2]).toHaveAttribute("data-color", "warning");
    expect(tooltipChips[3]).toHaveAttribute("data-color", "");
  });
});
