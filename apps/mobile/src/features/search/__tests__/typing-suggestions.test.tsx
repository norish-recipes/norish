// @vitest-environment jsdom
/** The typing state: the "Search for" row at once, skeletons while loading, a heading only for a kind with rows. */
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";

import type { NarrowRow } from "../utils/search-suggestions";
import { TypingSuggestions } from "../components/typing-suggestions";

type Box = { children?: ReactNode; testID?: string };
type RowProps = Box & { label: ReactNode; onPress?: () => void };

vi.mock("react-native", () => ({
  ScrollView: ({ children, testID }: Box) => <div data-testid={testID}>{children}</div>,
  View: ({ children }: Box) => <div>{children}</div>,
  Text: ({ children }: Box) => <span>{children}</span>,
}));
vi.mock("@/components/card", () => ({
  Card: ({ children, testID }: Box) => <div data-testid={testID}>{children}</div>,
  CardRow: ({ label, testID, onPress, children }: RowProps) => (
    <button data-testid={testID} onClick={onPress}>
      {label}
      {children}
    </button>
  ),
}));
vi.mock("@/components/card-photo", () => ({ CardPhoto: () => null }));
vi.mock("@/components/highlighted-text", () => ({
  HighlightedText: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("@/components/ingredient-icon", () => ({
  IngredientIcon: () => null,
  IngredientIconSlots: ({ children }: Box) => <>{children}</>,
}));
vi.mock("@/components/section-label", () => ({
  SectionLabel: ({ children }: Box) => <h2>{children}</h2>,
}));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => "#000" }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({ Skeleton: () => <i data-testid="skeleton" /> }));
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      values ? `${id}(${Object.values(values).join()})` : id,
  }),
}));
vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ navigation: { toRecipe: mocks.open } }),
}));
vi.mock("@norish/shared-react/ingredients", () => ({
  useIngredientIcons: (ids: string[]) => mocks.icons(ids),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  recipeCardFacts: () => ({ timeLabel: "30m", servings: 4 }),
}));

const mocks = vi.hoisted(() => ({ open: vi.fn(), icons: vi.fn() }));

const recipe = { id: "r1", name: "Hoisin Chicken", image: null } as RecipeDashboardDTO;
const base = {
  text: "chick",
  loading: false,
  recipes: [recipe],
  narrowRows: [
    { kind: "tag" as const, name: "chicken" },
    { kind: "category" as const, name: "Dinner", label: "Diner" },
  ],
  searchWords: "chick",
  onConfirm: vi.fn(),
  onNarrow: vi.fn(),
};

describe("the typing state", () => {
  it("confirms from the Search for row, opens a recipe, narrows to a row", () => {
    const onConfirm = vi.fn();
    const onNarrow = vi.fn();

    render(<TypingSuggestions {...base} onConfirm={onConfirm} onNarrow={onNarrow} />);
    fireEvent.click(screen.getByTestId("search-for-row"));
    fireEvent.click(screen.getByTestId("search-suggestion-recipe-r1"));
    fireEvent.click(screen.getByTestId("search-narrow-tag-chicken"));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(mocks.open).toHaveBeenCalledWith("r1");
    expect(onNarrow).toHaveBeenCalledWith({ kind: "tag", name: "chicken" });
  });

  it("shows a Category by its label and narrows by its stored name", () => {
    const onNarrow = vi.fn();

    render(<TypingSuggestions {...base} onNarrow={onNarrow} />);

    expect(screen.getByTestId("search-narrow-category-Dinner").textContent).toContain("Diner");

    fireEvent.click(screen.getByTestId("search-narrow-category-Dinner"));

    expect(onNarrow).toHaveBeenCalledWith({ kind: "category", name: "Dinner", label: "Diner" });
  });

  it("shows the Search for row and skeletons while loading, never an empty area", () => {
    render(<TypingSuggestions {...base} loading recipes={[]} narrowRows={[]} />);

    expect(screen.getByTestId("search-for-row")).toBeTruthy();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.getByText("recipes.search.recipes")).toBeTruthy();
    // One skeleton block per section, each with its own id.
    expect(screen.getByTestId("search-recipes-loading")).toBeTruthy();
    expect(screen.getByTestId("search-narrow-loading")).toBeTruthy();
  });

  it("leaves out the heading of a kind with no rows, and all of them with no matches", () => {
    const { rerender } = render(<TypingSuggestions {...base} recipes={[]} />);

    expect(screen.queryByText("recipes.search.recipes")).toBeNull();
    expect(screen.getByText("recipes.search.narrowTo")).toBeTruthy();

    rerender(<TypingSuggestions {...base} recipes={[]} narrowRows={[]} />);

    expect(screen.queryByText("recipes.search.narrowTo")).toBeNull();
    expect(screen.getByTestId("search-for-row")).toBeTruthy();
  });

  it("reads the icons of the suggested foods, as no other surface may have", () => {
    const narrowRows: NarrowRow[] = [
      { kind: "ingredient", id: "f1", name: "chicken", food: { name: "chicken", localeNames: {} } },
      { kind: "tag", name: "chicken" },
    ];

    render(<TypingSuggestions {...base} narrowRows={narrowRows} />);

    expect(mocks.icons).toHaveBeenLastCalledWith(["f1"]);
  });
});
