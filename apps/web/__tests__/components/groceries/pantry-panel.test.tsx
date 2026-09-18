/**
 * The Pantry panel: the household's names, a field that adds one at once,
 * and a refusal for a name the Pantry already holds by its folded form.
 */
import type { ReactNode } from "react";
import { PantryPanel } from "@/components/groceries/pantry/pantry-panel";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { PantryIngredientDto } from "@norish/shared/contracts";

// A Pantry Ingredient shows the picture its name matches (ADR-0037); this test
// is about the list itself, so no name has one.
const known = vi.hoisted(() => ({
  ingredients: [
    { id: "o", name: "Olive oil", imageUrl: "/o.webp" },
    { id: "s", name: "Sea salt", imageUrl: null },
  ],
}));

vi.mock("@/hooks/config/use-ingredient-names-query", () => ({
  useIngredientNamesQuery: () => ({ ingredients: known.ingredients, lookup: new Map() }),
}));

const addPantryIngredient = vi.fn(async () => "new");
const removePantryIngredient = vi.fn();
let items: PantryIngredientDto[] = [];

vi.mock("@/hooks/pantry", () => ({
  usePantryQuery: () => ({ items, isLoading: false }),
  usePantryMutations: () => ({ addPantryIngredient, removePantryIngredient }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({
    children,
    open,
    title,
  }: {
    children: ReactNode;
    open: boolean;
    title?: string;
  }) => (open ? <section aria-label={title}>{children}</section> : null);

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { default: Panel, usePanelPortalContainer: () => undefined };
});

vi.mock("@/components/shared/action-button", () => ({
  IconActionButton: ({ label, onPress, action }: any) => (
    <button aria-label={label} data-testid={`icon-${action}`} type="button" onClick={onPress} />
  ),
}));

function item(id: string, name: string, normalizedName: string): PantryIngredientDto {
  return {
    id,
    userId: "u1",
    ingredientId: `i-${normalizedName}`,
    name,
    normalizedName,
    version: 1,
  };
}

describe("PantryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    items = [item("salt", "Salt", "salt"), item("olive", "Olive Oil", "olive oil")];
  });

  it("lists the Pantry by name, with a way out for each", () => {
    render(<PantryPanel open onOpenChange={() => undefined} />);

    const rows = screen.getAllByRole("listitem");

    expect(rows.map((row) => row.textContent)).toEqual(["Olive Oil", "Salt"]);
    fireEvent.click(screen.getAllByTestId("icon-remove")[1]!);
    expect(removePantryIngredient).toHaveBeenCalledWith("salt");
  });

  it("says when there is nothing in it", () => {
    items = [];
    render(<PantryPanel open onOpenChange={() => undefined} />);

    expect(screen.getByTestId("pantry-empty")).toHaveTextContent("empty");
  });

  it("adds a typed name on Enter and clears the field for the next", async () => {
    render(<PantryPanel open onOpenChange={() => undefined} />);
    const field = screen.getByTestId("pantry-name");

    expect(screen.getByTestId("add-pantry-ingredient")).toBeDisabled();
    await act(async () => {
      fireEvent.change(field, { target: { value: "  Flour " } });
    });
    expect(screen.getByTestId("add-pantry-ingredient")).toBeEnabled();
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });

    expect(addPantryIngredient).toHaveBeenCalledWith("Flour");
    expect(field).toHaveValue("");
  });

  it("offers the names Norish knows, and picking one fills the field", async () => {
    render(<PantryPanel open onOpenChange={() => undefined} />);
    const field = screen.getByTestId("pantry-name");

    await act(async () => {
      fireEvent.change(field, { target: { value: "sea sa" } });
    });

    const suggestions = screen.getAllByTestId("name-suggestion");

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toHaveTextContent("Sea salt");

    await act(async () => {
      fireEvent.click(suggestions[0]!);
    });

    expect(field).toHaveValue("Sea salt");
    expect(screen.queryByTestId("name-suggestions")).not.toBeInTheDocument();
    expect(addPantryIngredient).not.toHaveBeenCalled();

    // The name is added by the gesture that always added it.
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });
    expect(addPantryIngredient).toHaveBeenCalledWith("Sea salt");
  });

  it("takes the highlighted name with Enter, and leaves Enter alone otherwise", async () => {
    render(<PantryPanel open onOpenChange={() => undefined} />);
    const field = screen.getByTestId("pantry-name");

    await act(async () => {
      fireEvent.change(field, { target: { value: "sea sa" } });
    });
    await act(async () => {
      fireEvent.keyDown(field, { key: "ArrowDown" });
    });
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });

    expect(field).toHaveValue("Sea salt");
    expect(addPantryIngredient).not.toHaveBeenCalled();

    // Nothing highlighted: Enter adds what was typed, suggestions or not.
    await act(async () => {
      fireEvent.change(field, { target: { value: "oat milk" } });
    });
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });
    expect(addPantryIngredient).toHaveBeenCalledWith("oat milk");
  });

  it("leaves out a name the Pantry already holds", async () => {
    render(<PantryPanel open onOpenChange={() => undefined} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId("pantry-name"), { target: { value: "oli" } });
    });

    expect(screen.queryByTestId("name-suggestions")).not.toBeInTheDocument();
  });

  it("refuses a name the Pantry already holds, by its folded form", async () => {
    render(<PantryPanel open onOpenChange={() => undefined} />);
    const field = screen.getByTestId("pantry-name");

    await act(async () => {
      fireEvent.change(field, { target: { value: " OLIVE  oil! " } });
    });

    expect(screen.getByTestId("pantry-duplicate")).toHaveTextContent("duplicate");
    expect(screen.getByTestId("add-pantry-ingredient")).toBeDisabled();
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });
    expect(addPantryIngredient).not.toHaveBeenCalled();
  });
});
