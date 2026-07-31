import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import IngredientInput from "@/components/recipes/ingredient-input";

vi.mock("@/hooks/config", () => ({
  useUnitsQuery: () => ({ units: {} }),
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
});
