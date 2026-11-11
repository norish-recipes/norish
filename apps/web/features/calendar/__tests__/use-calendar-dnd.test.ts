/** A planned item dropped on another day moves there; a drop anywhere else moves nothing. */
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useCalendarDnd } from "@/features/calendar/hooks/use-calendar-dnd";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

const moveItem = vi.fn();

vi.mock("@norish/shared-react/calendar", () => ({
  useCalendarMutations: () => ({ moveItem }),
}));

const item = (id: string, date: string, slot: "Lunch" | "Dinner") =>
  ({
    id,
    date,
    slot,
    sortOrder: 0,
    itemType: "note",
    recipeId: null,
    title: id,
  }) as PlannedItemFromQuery;

const CALENDAR = {
  "2026-11-11": [item("soup", "2026-11-11", "Dinner")],
  "2026-11-12": [item("salad", "2026-11-12", "Dinner"), item("toast", "2026-11-12", "Lunch")],
};

function render() {
  moveItem.mockClear();
  const view = renderHook(() => useCalendarDnd(CALENDAR, []));
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

  return { view, dragSoupOnto };
}

describe("useCalendarDnd", () => {
  it("moves an item dropped on another day to the end of its slot there", () => {
    const { view, dragSoupOnto } = render();

    dragSoupOnto("2026-11-12_drop");

    expect(moveItem).toHaveBeenCalledExactlyOnceWith("soup", "2026-11-12", "Dinner", 1);
    expect(view.result.current.activeItem).toBeNull();
  });

  it.each([
    ["nothing", null],
    ["its own day", "2026-11-11_drop"],
    ["another item", "salad"],
  ])("moves nothing when dropped on %s", (_, overId) => {
    const { view, dragSoupOnto } = render();

    dragSoupOnto(overId);

    expect(moveItem).not.toHaveBeenCalled();
    expect(view.result.current.activeItem).toBeNull();
  });
});
