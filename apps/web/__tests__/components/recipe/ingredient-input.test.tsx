import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import IngredientInput from "@/components/recipes/ingredient-input";

vi.mock("@/hooks/config", () => ({
  useUnitsQuery: () => ({ units: {} }),
}));

// The foods the typed names already name, as the catalogue would answer.
const foods = vi.hoisted(() => new Map<string, string | null>());

vi.mock("@/components/ingredients/ingredient-icon", () => ({
  IngredientIcon: ({ ingredientId }: { ingredientId: string | null }) => (
    <span data-food={ingredientId ?? ""} data-testid="row-icon" />
  ),
  IngredientIconsProvider: ({ children }: { children?: React.ReactNode }) => children,
  useFoodsByName: () => foods,
}));

vi.mock("@/hooks/recipes", () => ({
  useRecipeAutocomplete: () => ({ suggestions: [], isLoading: false }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Drag-and-drop is irrelevant here, and the real library needs layout
// measurements jsdom cannot provide.
vi.mock("motion/react", () => ({
  Reorder: {
    Group: ({ children }: { children?: React.ReactNode }) => <ul>{children}</ul>,
    Item: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  },
  useDragControls: () => ({ start: () => undefined }),
}));

describe("IngredientInput", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("commits the parsed ingredient on blur without waiting out the debounce", () => {
    const onChange = vi.fn();

    render(<IngredientInput ingredients={[]} onChange={onChange} />);

    const input = screen.getByPlaceholderText("placeholder");

    fireEvent.change(input, { target: { value: "200 g pinto beans" } });
    expect(onChange).not.toHaveBeenCalled();

    // Blur must commit synchronously: a submit click lands within the debounce
    // window, and the row it blurs may otherwise never reach the form.
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);

    const rows = onChange.mock.calls[0][0];

    expect(rows).toHaveLength(1);
    expect(rows[0].ingredientName).toContain("pinto beans");
  });

  it("still commits through the debounce while the field stays focused", () => {
    vi.useFakeTimers();

    const onChange = vi.fn();

    render(<IngredientInput ingredients={[]} onChange={onChange} />);

    const input = screen.getByPlaceholderText("placeholder");

    fireEvent.change(input, { target: { value: "200 g pinto beans" } });
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].ingredientName).toContain("pinto beans");
  });

  it("shows each row's food icon once the name names a known food, and a heading none", () => {
    foods.set("pinto beans", "pinto-food");

    render(
      <IngredientInput
        ingredients={[
          { ingredientName: "# Beans", amount: null, unit: null, order: 0, systemUsed: "metric" },
          {
            ingredientName: "pinto beans",
            amount: null,
            unit: null,
            order: 1,
            systemUsed: "metric",
          },
          { ingredientName: "kohlrabi", amount: null, unit: null, order: 2, systemUsed: "metric" },
        ]}
        onChange={vi.fn()}
      />
    );

    // The heading has no slot; the trailing empty row keeps its placeholder.
    expect(screen.getAllByTestId("row-icon").map((icon) => icon.dataset.food)).toEqual([
      "pinto-food",
      "",
      "",
    ]);
  });
});
