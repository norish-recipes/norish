import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import ServingsControl from "@/features/recipes/components/page/servings-control";

import { onRecipePage } from "./recipe-page";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: { count?: number }) =>
    values?.count === undefined ? `${namespace}.${key}` : `${values.count} servings`,
}));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);

vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div data-testid="servings-panel">{children}</div> : null;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { default: Panel };
});

/** The control on a recipe for 4, at `servings` when given. */
function renderControl(ui: ReactNode, servings?: number) {
  const { wrapper, page } = onRecipePage({ id: "recipe-1", servings: 4 });

  render(ui, { wrapper });
  if (servings !== undefined) act(() => page().setServings(servings));

  return page;
}

describe("ServingsControl's panel (#682)", () => {
  it("opens from the figure and multiplies the recipe's own servings in one tap", () => {
    const page = renderControl(<ServingsControl />, 5);

    fireEvent.click(screen.getByRole("button", { name: "5 servings" }));
    fireEvent.click(screen.getByRole("button", { name: "2×" }));

    expect(page().servings).toBe(8);
    expect(screen.queryByTestId("servings-panel")).toBeNull();
  });

  it("marks the multiple the servings are at", () => {
    renderControl(<ServingsControl />, 2);

    fireEvent.click(screen.getByRole("button", { name: "2 servings" }));

    expect(screen.getByRole("button", { name: "½×" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute("aria-pressed", "false");
  });

  it("takes any number of servings as it is typed, decimal commas too", () => {
    const page = renderControl(<ServingsControl />);

    fireEvent.click(screen.getByRole("button", { name: "4 servings" }));
    const field = screen.getByRole("textbox", { name: "recipes.form.servings" });

    expect(field).toHaveValue("4");
    fireEvent.change(field, { target: { value: "1,5" } });
    expect(page().servings).toBe(1.5);

    fireEvent.change(field, { target: { value: "" } });
    fireEvent.change(field, { target: { value: "0" } });
    expect(page().servings).toBe(1.5);

    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.queryByTestId("servings-panel")).toBeNull();
  });

  it("takes any multiplier, and each field follows the other", () => {
    const page = renderControl(<ServingsControl />);

    fireEvent.click(screen.getByRole("button", { name: "4 servings" }));
    const servings = screen.getByRole("textbox", { name: "recipes.form.servings" });
    const multiplier = screen.getByRole("textbox", { name: "recipes.detail.multiplier" });

    expect(multiplier).toHaveValue("1");
    fireEvent.change(multiplier, { target: { value: "1,5" } });
    expect(page().servings).toBe(6);
    expect(servings).toHaveValue("6");
    expect(multiplier).toHaveValue("1,5");

    fireEvent.change(servings, { target: { value: "10" } });
    expect(multiplier).toHaveValue("2.5");

    fireEvent.click(screen.getByRole("button", { name: "common.actions.done" }));
    expect(screen.queryByTestId("servings-panel")).toBeNull();
  });

  it("is a plain figure where no panel can open", () => {
    renderControl(<ServingsControl withPanel={false} />);

    expect(screen.queryByRole("button", { name: "4 servings" })).toBeNull();
    expect(screen.getByText("4 servings")).toHaveClass("sr-only");
  });
});
