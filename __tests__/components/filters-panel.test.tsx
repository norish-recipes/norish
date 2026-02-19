import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const filtersState = {
  searchTags: [] as string[],
  categories: [] as string[],
  filterMode: "AND" as const,
  sortMode: "dateDesc" as "dateDesc" | undefined,
  rawInput: "",
  showFavoritesOnly: false,
  minRating: null as number | null,
  maxCookingTime: null as number | null,
};

const userPreferencesState = {
  showRatings: true,
  showFavorites: true,
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("motion/react", () => ({
  motion: {
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

vi.mock("@/components/Panel/Panel", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/search-field-toggles", () => ({
  default: () => <div>search-field-toggles</div>,
}));

vi.mock("@/components/skeleton/chip-skeleton", () => ({
  default: () => <div>loading</div>,
}));

vi.mock("@/components/shared/rating-stars", () => ({
  default: () => <div>rating-stars</div>,
}));

vi.mock("@/context/recipes-filters-context", () => ({
  useRecipesFiltersContext: () => ({
    filters: filtersState,
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
  }),
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({
    user: { preferences: userPreferencesState },
  }),
}));

vi.mock("@/hooks/config", () => ({
  useTagsQuery: () => ({
    tags: ["Dinner", "Quick", "Vegetarian", "Soup", "Pasta", "Spicy"],
    isLoading: false,
  }),
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children, onPress, startContent: _startContent, ...props }: any) => (
    <button onClick={onPress} {...props}>
      {children}
    </button>
  ),
  Chip: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    isClearable: _isClearable,
    startContent: _startContent,
    onClear: _onClear,
    classNames: _classNames,
    ...props
  }: any) => <input value={value} onChange={onChange} {...props} />,
}));

import FiltersPanel from "@/components/Panel/consumers/filters-panel";

describe("FiltersPanel", () => {
  it("does not crash when sort mode is missing", () => {
    filtersState.sortMode = undefined;

    expect(() => render(<FiltersPanel open onOpenChange={vi.fn()} />)).not.toThrow();

    expect(screen.getByText("sortByDate")).toHaveAttribute("color", "default");
    expect(screen.getByText("sortByTitle")).toHaveAttribute("color", "default");

    filtersState.sortMode = "dateDesc";
  });

  it("limits tag container height and enables vertical scrolling", () => {
    filtersState.sortMode = "dateDesc";

    const { container } = render(<FiltersPanel open onOpenChange={vi.fn()} />);

    const tagContainer = container.querySelector(".overflow-y-auto");

    expect(tagContainer).toBeInTheDocument();
    expect(tagContainer).toHaveClass("max-h-[220px]");
  });

  it("hides favorites and rating section when both preferences are disabled", () => {
    userPreferencesState.showFavorites = false;
    userPreferencesState.showRatings = false;

    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.queryByText("favoritesAndRating")).not.toBeInTheDocument();
    expect(screen.queryByText("favorites")).not.toBeInTheDocument();
    expect(screen.queryByText("rating-stars")).not.toBeInTheDocument();

    userPreferencesState.showFavorites = true;
    userPreferencesState.showRatings = true;
  });

  it("shows only favorites filter when ratings are disabled", () => {
    userPreferencesState.showFavorites = true;
    userPreferencesState.showRatings = false;

    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.getByText("favoritesAndRating")).toBeInTheDocument();
    expect(screen.getByText("favorites")).toBeInTheDocument();
    expect(screen.queryByText("rating-stars")).not.toBeInTheDocument();

    userPreferencesState.showRatings = true;
  });

  it("shows only rating filter when favorites are disabled", () => {
    userPreferencesState.showFavorites = false;
    userPreferencesState.showRatings = true;

    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.getByText("favoritesAndRating")).toBeInTheDocument();
    expect(screen.queryByText("favorites")).not.toBeInTheDocument();
    expect(screen.getByText("rating-stars")).toBeInTheDocument();

    userPreferencesState.showFavorites = true;
  });
});
