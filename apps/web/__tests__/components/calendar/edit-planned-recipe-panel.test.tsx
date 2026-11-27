/** A planned recipe's panel: a link to the recipe, or its title alone when it is out of view. */
import type { ReactNode } from "react";
import { EditPlannedRecipePanel } from "@/features/calendar/components/panels/edit-planned-recipe-panel";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

const held = vi.hoisted(() => ({ planRecipe: vi.fn(), moveItem: vi.fn(), deleteItem: vi.fn() }));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@norish/shared-react/calendar", () => ({ useCalendarMutations: () => held }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { Panel, PanelPortal: ({ children }: { children: ReactNode }) => <>{children}</> };
});
vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children, start }: { children: ReactNode; start: ReactNode }) => (
    <div>
      {start}
      {children}
    </div>
  ),
}));

const props = { open: true, onOpenChange: vi.fn() };
const item = (recipeId: string | null) =>
  ({
    id: "item-1",
    itemType: "recipe",
    recipeId,
    recipeName: "Stew",
    recipeImage: "/recipes/r1/a.jpg",
    date: "2026-11-12",
    slot: "Dinner",
  }) as PlannedItemFromQuery;

describe("EditPlannedRecipePanel", () => {
  it("links to a recipe the household may view, and plans it again", () => {
    render(<EditPlannedRecipePanel {...props} item={item("r1")} />);

    expect(screen.getByRole("link").getAttribute("href")).toBe("/recipes/r1");
    fireEvent.click(screen.getByText("duplicate"));
    expect(held.planRecipe).toHaveBeenCalledWith("2026-11-12", "Dinner", "r1");
  });

  it("shows a recipe out of view by its title alone, with nothing to open or plan again", () => {
    render(<EditPlannedRecipePanel {...props} item={item(null)} />);

    expect(screen.getByTestId("planned-recipe-title-only").textContent).toContain("Stew");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("duplicate")).toBeNull();
    expect(screen.getByText("delete")).toBeTruthy();
  });
});
