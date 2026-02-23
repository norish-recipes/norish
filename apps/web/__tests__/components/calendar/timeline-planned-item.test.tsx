import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { TimelinePlannedItem } from "@/components/calendar/mobile/timeline-planned-item";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/recipes/use-recipe-prefetch", () => ({
  useRecipePrefetch: () => vi.fn(),
}));

vi.mock("@/components/calendar/mobile/planned-item-content", () => ({
  PlannedItemContent: () => <span>planned item</span>,
}));

vi.mock("@dnd-kit/core", () => ({
  useDraggable: () => ({
    setNodeRef: vi.fn(),
    attributes: {},
    listeners: {},
    isDragging: false,
  }),
}));

describe("TimelinePlannedItem", () => {
  it("allows vertical touch scrolling on planned item cards", () => {
    render(
      <TimelinePlannedItem
        item={{
          id: "item-1",
          date: "2026-02-11",
          slot: "Lunch",
          sortOrder: 0,
          itemType: "recipe",
          recipeId: "recipe-1",
          recipeName: "Pasta",
          title: null,
        }}
      />
    );

    const draggable = screen.getByText("planned item").closest("div");

    expect(draggable).toHaveClass("touch-pan-y");
    expect(draggable).not.toHaveClass("touch-none");
  });
});
