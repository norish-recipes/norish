/** A planned item dropped on another day moves there; a drop anywhere else moves nothing. */
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { fakeProcedure } from "@/__tests__/helpers/trpc-fake";
import { useCalendarDnd } from "@/features/calendar/hooks/use-calendar-dnd";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);

const RANGE_KEY = fakeProcedure("calendar.listItems").queryKey({
  startISO: "2026-11-09",
  endISO: "2026-11-15",
});

const item = (id: string, date: string, slot: "Lunch" | "Dinner"): PlannedItemFromQuery => ({
  id,
  userId: "user-1",
  date,
  slot,
  sortOrder: 0,
  itemType: "note",
  recipeId: null,
  title: id,
  recipeName: null,
  recipeImage: null,
  servings: null,
  calories: null,
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const ITEMS = [
  item("soup", "2026-11-11", "Dinner"),
  item("salad", "2026-11-12", "Dinner"),
  item("toast", "2026-11-12", "Lunch"),
];

const CALENDAR = {
  "2026-11-11": ITEMS.slice(0, 1),
  "2026-11-12": ITEMS.slice(1),
};

function render() {
  const queryClient = createTestQueryClient();

  queryClient.setQueryData(RANGE_KEY, ITEMS);

  const view = renderHook(() => useCalendarDnd(CALENDAR, []), {
    wrapper: createTestWrapper(queryClient),
  });
  const dragSoupOnto = (overId: string | null) => {
    act(() =>
      view.result.current.dndContextProps.onDragStart({ active: { id: "soup" } } as DragStartEvent)
    );
    act(() =>
      view.result.current.dndContextProps.onDragEnd({
        active: { id: "soup" },
        over: overId === null ? null : { id: overId },
      } as unknown as DragEndEvent)
    );
  };
  const cached = () => queryClient.getQueryData<PlannedItemFromQuery[]>(RANGE_KEY);

  return { view, dragSoupOnto, cached };
}

describe("useCalendarDnd", () => {
  it("moves an item dropped on another day to the end of its slot there", async () => {
    const { view, dragSoupOnto, cached } = render();

    dragSoupOnto("2026-11-12_drop");

    await waitFor(() =>
      expect(cached()?.find((i) => i.id === "soup")).toMatchObject({
        date: "2026-11-12",
        slot: "Dinner",
        sortOrder: 1,
      })
    );
    expect(view.result.current.activeItem).toBeNull();
  });

  it.each([
    ["nothing", null],
    ["its own day", "2026-11-11_drop"],
    ["another item", "salad"],
  ])("moves nothing when dropped on %s", async (_, overId) => {
    const { view, dragSoupOnto, cached } = render();

    dragSoupOnto(overId);
    // A write's optimistic step runs on the next tick, so give it one.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cached()).toBe(ITEMS);
    expect(view.result.current.activeItem).toBeNull();
  });
});
