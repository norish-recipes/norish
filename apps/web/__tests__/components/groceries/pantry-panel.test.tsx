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
