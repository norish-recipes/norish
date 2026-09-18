import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import IngredientInput from "@/components/recipes/ingredient-input";

const known = vi.hoisted(() => {
  const ingredients = [
    {
      id: "f",
      name: "Flour",
      imageUrl: "/ingredient-images/f.webp",
    },
    {
      id: "c",
      name: "Coriander",
      imageUrl: null,
    },
    // No picture: suggested all the same.
    {
      id: "s",
      name: "Sea salt",
      imageUrl: null,
    },
  ];

  return { ingredients };
});

vi.mock("@/hooks/config", async () => {
  const { buildIngredientLookup } = await import("@norish/shared/lib/ingredient-pictures");

  return {
    useUnitsQuery: () => ({ units: {} }),
    useIngredientNamesQuery: () => ({
      ingredients: known.ingredients,
      lookup: buildIngredientLookup(known.ingredients),
    }),
  };
});

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

  it("offers known ingredient names for the name part and rewrites only that part", () => {
    const onChange = vi.fn();

    render(<IngredientInput ingredients={[]} onChange={onChange} />);

    const input = screen.getByPlaceholderText("placeholder") as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: "2 cups flo" } });

    const suggestions = screen.getAllByTestId("name-suggestion");

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toHaveTextContent("Flour");

    fireEvent.click(suggestions[0]!);

    expect(input.value).toBe("2 cups Flour");
    expect(screen.queryByTestId("name-suggestions")).not.toBeInTheDocument();
  });

  it("picks the highlighted suggestion with Enter, and leaves Enter alone otherwise", () => {
    render(<IngredientInput ingredients={[]} onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("placeholder") as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: "cori" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    // The Ingredient Name itself is inserted, so the line says what it means.
    expect(input.value).toBe("Coriander");

    // Nothing highlighted: Enter is the row's own "next line" gesture.
    fireEvent.change(input, { target: { value: "coriander and more cori" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("offers a name that has no picture", () => {
    render(<IngredientInput ingredients={[]} onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("placeholder") as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: "1 tsp sea sa" } });

    const suggestions = screen.getAllByTestId("name-suggestion");

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toHaveTextContent("Sea salt");

    fireEvent.click(suggestions[0]!);

    expect(input.value).toBe("1 tsp Sea salt");
    expect(screen.queryByTestId("ingredient-illustration")).not.toBeInTheDocument();
  });

  it("offers nothing for free text no known ingredient matches, keeping it as typed", () => {
    const onChange = vi.fn();

    render(<IngredientInput ingredients={[]} onChange={onChange} />);

    const input = screen.getByPlaceholderText("placeholder");

    fireEvent.change(input, { target: { value: "1 pinch of dragon dust" } });
    expect(screen.queryByTestId("name-suggestions")).not.toBeInTheDocument();

    fireEvent.blur(input);
    expect(onChange.mock.calls[0]![0][0].ingredientName).toContain("dragon dust");
  });

  it("shows the matched picture beside a row whose name has one", () => {
    render(<IngredientInput ingredients={[]} onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("placeholder");

    expect(screen.queryByTestId("ingredient-illustration")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "500 g flour" } });

    expect(screen.getByTestId("ingredient-illustration")).toHaveAttribute(
      "src",
      "/ingredient-images/f.webp"
    );
  });
});
