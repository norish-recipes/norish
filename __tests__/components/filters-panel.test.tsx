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
});
