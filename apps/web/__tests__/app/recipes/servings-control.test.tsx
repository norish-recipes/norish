import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import ServingsControl from "@/app/(app)/recipes/[id]/components/servings-control";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: { count?: number }) =>
    values?.count === undefined ? `${namespace}.${key}` : `${values.count} servings`,
}));

const recipeState = vi.hoisted(() => ({
  currentServings: null as number | null,
  setIngredientAmounts: vi.fn(),
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContextRequired: () => ({
    recipe: { servings: 4 },
    currentServings: recipeState.currentServings,
    setIngredientAmounts: recipeState.setIngredientAmounts,
  }),
}));

vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div data-testid="servings-panel">{children}</div> : null;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { default: Panel };
});

describe("ServingsControl's panel (#682)", () => {
  beforeEach(() => {
    recipeState.currentServings = null;
    recipeState.setIngredientAmounts.mockClear();
  });

  it("opens from the figure and multiplies the recipe's own servings in one tap", () => {
    recipeState.currentServings = 5;
    render(<ServingsControl />);

    fireEvent.click(screen.getByRole("button", { name: "5 servings" }));
    fireEvent.click(screen.getByRole("radio", { name: "2×" }));

    expect(recipeState.setIngredientAmounts).toHaveBeenCalledWith(8);
    expect(screen.queryByTestId("servings-panel")).toBeNull();
  });

  it("marks the multiple the servings are at", () => {
    recipeState.currentServings = 2;
    render(<ServingsControl />);

    fireEvent.click(screen.getByRole("button", { name: "2 servings" }));

    expect(screen.getByRole("radio", { name: "½×" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "1×" })).not.toBeChecked();
  });

  it("takes any number of servings as it is typed, decimal commas too", () => {
    render(<ServingsControl />);

    fireEvent.click(screen.getByRole("button", { name: "4 servings" }));
    const field = screen.getByRole("textbox", { name: "recipes.form.servings" });

    expect(field).toHaveValue("4");
    fireEvent.change(field, { target: { value: "1,5" } });
    expect(recipeState.setIngredientAmounts).toHaveBeenLastCalledWith(1.5);

    fireEvent.change(field, { target: { value: "" } });
    fireEvent.change(field, { target: { value: "0" } });
    expect(recipeState.setIngredientAmounts).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.queryByTestId("servings-panel")).toBeNull();
  });

  it("takes any multiplier, and each field follows the other", () => {
    render(<ServingsControl />);

    fireEvent.click(screen.getByRole("button", { name: "4 servings" }));
    const servings = screen.getByRole("textbox", { name: "recipes.form.servings" });
    const multiplier = screen.getByRole("textbox", { name: "recipes.detail.multiplier" });

    expect(multiplier).toHaveValue("1");
    fireEvent.change(multiplier, { target: { value: "1,5" } });
    expect(recipeState.setIngredientAmounts).toHaveBeenLastCalledWith(6);
    expect(servings).toHaveValue("6");
    expect(multiplier).toHaveValue("1,5");

    fireEvent.change(servings, { target: { value: "10" } });
    expect(multiplier).toHaveValue("2.5");
  });

  it("is a plain figure where no panel can open", () => {
    render(<ServingsControl withPanel={false} />);

    expect(screen.queryByRole("button", { name: "4 servings" })).toBeNull();
    expect(screen.getByText("4 servings")).toHaveClass("sr-only");
  });
});
