import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import RecipePageTint from "@/components/recipes/recipe-page-tint";

import type { RecipePageColorMode } from "@norish/shared/contracts/zod/device-preferences";

import { renderWithDevicePreferences } from "../../helpers/device-preferences";

vi.mock("@/app/providers/trpc-provider", () => import("../../helpers/device-preferences-trpc"));

function renderTint(dishColor: string | null | undefined, colorMode?: RecipePageColorMode) {
  return renderWithDevicePreferences(
    <RecipePageTint dishColor={dishColor}>
      <span data-testid="content">the page</span>
    </RecipePageTint>,
    { values: colorMode ? { recipePageColor: colorMode } : {} }
  );
}

describe("RecipePageTint", () => {
  it("scopes the channel variables and paints the viewport underlay for a Dish Colour", () => {
    const { container, getByTestId } = renderTint("#c04020");
    const scope = container.querySelector("[data-dish-tint]") as HTMLElement;

    expect(scope).not.toBeNull();
    expect(scope.style.getPropertyValue("--dish-h")).not.toBe("");
    expect(scope.style.getPropertyValue("--dish-c")).not.toBe("");
    expect(container.querySelector(".bg-background.fixed")).not.toBeNull();
    expect(getByTestId("content")).toBeInTheDocument();
  });

  it("emits no attribute, no variables and no underlay without one", () => {
    const { container, getByTestId } = renderTint(null);

    expect(container.querySelector("[data-dish-tint]")).toBeNull();
    expect(container.querySelector(".bg-background.fixed")).toBeNull();
    expect(getByTestId("content")).toBeInTheDocument();
  });

  it("renders the absent, the undefined and the unparseable colour identically", () => {
    const noColor = renderTint(null).container.innerHTML;

    expect(renderTint(undefined).container.innerHTML).toBe(noColor);
    expect(renderTint("not-a-colour").container.innerHTML).toBe(noColor);
  });

  it("renders a theme-preference reader identically to a no-Dish-Colour recipe", () => {
    // The one untinted code path: declining the tint and having no colour
    // meet at the same dishTintStyle(null), so the two cannot drift apart.
    const noColor = renderTint(null, "dish").container.innerHTML;

    expect(renderTint("#c04020", "theme").container.innerHTML).toBe(noColor);
  });

  it("never paints a tinted first frame for a reader seeded to theme colours", () => {
    // Seeded server-side (or read from the restored profile Offline), the
    // preference is already `theme` on the very first render — there is no
    // tinted-then-corrected frame for the reader to see.
    const { container } = renderTint("#c04020", "theme");

    expect(container.querySelector("[data-dish-tint]")).toBeNull();
  });

  it("stays out of layout — the wrapper is display: contents", () => {
    const { container } = renderTint("#c04020");

    expect((container.firstElementChild as HTMLElement).className).toContain("contents");
  });
});
