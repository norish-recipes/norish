import type { ReactNode } from "react";
import { fireEvent, render as renderBare, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import FiltersPanel from "@/features/library/components/filters/filters-panel";

import { LibraryFiltersProvider, useLibraryFilters } from "@norish/shared-react/recipes";
import { DEFAULT_PERSISTED_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

const reads = vi.hoisted(() => ({ tags: vi.fn(), categories: vi.fn() }));

/** The panel under a Library filters store made from the default filters. */
function render(ui: ReactNode) {
  return renderBare(
    <LibraryFiltersProvider initial={DEFAULT_PERSISTED_RECIPE_FILTERS}>{ui}</LibraryFiltersProvider>
  );
}

/** The panel, opened and closed by the test, beside a button that applies Pantry only directly. */
function Harness({ open }: { open: boolean }) {
  const setFilters = useLibraryFilters((state) => state.setFilters);

  return (
    <>
      <button type="button" onClick={() => setFilters({ showPantryOnly: true })}>
        store-pantry
      </button>
      <FiltersPanel open={open} onOpenChange={vi.fn()} />
    </>
  );
}

const userPreferencesState = {
  hidden: [] as string[],
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("motion/react", () => ({
  motion: {
    span: ({
      animate: _animate,
      children,
      initial: _initial,
      transition: _transition,
      ...props
    }: any) => <span {...props}>{children}</span>,
  },
}));

vi.mock("@/components/Panel/Panel", () => {
  // The real panel mounts its content only while open.
  const Panel = ({ children, open }: any) => (open ? <div>{children}</div> : null);

  Panel.Body = ({ children }: any) => <div>{children}</div>;
  Panel.Footer = ({ children }: any) => <div>{children}</div>;

  return {
    default: Panel,
  };
});

vi.mock("@/features/library/components/filters/search-field-toggles", () => ({
  default: () => <div>search-field-toggles</div>,
}));

vi.mock("@/features/library/components/skeleton/chip-skeleton", () => ({
  default: () => <div>loading</div>,
}));

vi.mock("@norish/ui/star-rating", () => ({
  default: () => <div>rating-stars</div>,
}));

vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(() => ({
    hiddenItems: userPreferencesState.hidden,
  }))
);

vi.mock("@norish/shared-react/config", () => ({
  useCategoriesQuery: () => {
    reads.categories();

    return { categories: ["Breakfast", "Lunch", "Dinner", "Snack", "Drinks"], isLoading: false };
  },
  useTagsQuery: () => {
    reads.tags();

    return { tags: ["Dinner", "Quick", "Vegetarian", "Soup", "Pasta", "Spicy"], isLoading: false };
  },
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

describe("FiltersPanel", () => {
  it("limits tag container height and enables vertical scrolling", () => {
    const { container } = render(<FiltersPanel open onOpenChange={vi.fn()} />);

    const tagContainer = container.querySelector(".overflow-y-auto");

    expect(tagContainer).toBeInTheDocument();
    expect(tagContainer).toHaveClass("max-h-[220px]");
  });

  it("hides favorites and rating section when both preferences are disabled", () => {
    userPreferencesState.hidden = ["favorites", "rating"];

    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.queryByText("favoritesAndRating")).not.toBeInTheDocument();
    expect(screen.queryByText("favorites")).not.toBeInTheDocument();
    expect(screen.queryByText("rating-stars")).not.toBeInTheDocument();

    userPreferencesState.hidden = [];
  });

  it("shows only favorites filter when ratings are disabled", () => {
    userPreferencesState.hidden = ["rating"];

    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.getByText("favoritesAndRating")).toBeInTheDocument();
    expect(screen.getByText("favorites")).toBeInTheDocument();
    expect(screen.queryByText("rating-stars")).not.toBeInTheDocument();

    userPreferencesState.hidden = [];
  });

  it("shows only rating filter when favorites are disabled", () => {
    userPreferencesState.hidden = ["favorites"];

    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.getByText("favoritesAndRating")).toBeInTheDocument();
    expect(screen.queryByText("favorites")).not.toBeInTheDocument();
    expect(screen.getByText("rating-stars")).toBeInTheDocument();

    userPreferencesState.hidden = [];
  });

  it("offers the household's own Categories beside the built-ins", () => {
    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "category.breakfast" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drinks" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reads no tags or Categories while closed", () => {
    reads.tags.mockClear();
    reads.categories.mockClear();

    render(<FiltersPanel open={false} onOpenChange={vi.fn()} />);

    expect(reads.tags).not.toHaveBeenCalled();
    expect(reads.categories).not.toHaveBeenCalled();
  });

  it("starts each opening from the applied filters, dropping what was not applied", () => {
    const view = render(<Harness open />);
    const pantryOnly = () => screen.getByRole("button", { name: "pantryOnly" });

    fireEvent.click(pantryOnly());
    expect(pantryOnly()).toHaveAttribute("aria-pressed", "true");

    // Closed without Apply: the next opening shows the filters as they are.
    view.rerender(
      <LibraryFiltersProvider initial={DEFAULT_PERSISTED_RECIPE_FILTERS}>
        <Harness open={false} />
      </LibraryFiltersProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "store-pantry" }));
    view.rerender(
      <LibraryFiltersProvider initial={DEFAULT_PERSISTED_RECIPE_FILTERS}>
        <Harness open />
      </LibraryFiltersProvider>
    );
    expect(pantryOnly()).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(pantryOnly());
    view.rerender(
      <LibraryFiltersProvider initial={DEFAULT_PERSISTED_RECIPE_FILTERS}>
        <Harness open={false} />
      </LibraryFiltersProvider>
    );
    view.rerender(
      <LibraryFiltersProvider initial={DEFAULT_PERSISTED_RECIPE_FILTERS}>
        <Harness open />
      </LibraryFiltersProvider>
    );
    expect(pantryOnly()).toHaveAttribute("aria-pressed", "true");
  });
});
