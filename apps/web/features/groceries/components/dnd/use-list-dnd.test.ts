/**
 * A drag's arrangement: the Stores show it from the drag's start until the
 * list it was dropped on comes back, and read their own rows otherwise.
 */
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";

import { useListDnd } from "./use-list-dnd";

const MILK = { id: "milk", name: "milk", ingredientId: "i-milk" } as GroceryDto;
const BREAD = { id: "bread", name: "bread", ingredientId: "i-bread" } as GroceryDto;
const ROWS = new Map([MILK, BREAD].map((grocery) => [grocery.id, grocery]));

function render() {
  const onReorder = vi.fn();
  const view = renderHook(
    ({ source }) =>
      useListDnd({
        items: { unsorted: ["milk", "bread"] },
        source: [source],
        linesOf: (key) => (ROWS.has(key) ? [ROWS.get(key)!] : []),
        stores: [] as StoreDto[],
        aisleFor: () => null,
        onReorder,
        onFileGroceryName: vi.fn(),
      }),
    { initialProps: { source: {} } }
  );
  const drag = (id: string) =>
    act(() => view.result.current.handleDragStart({ active: { id } } as DragStartEvent));
  const drop = (id: string, overId: string | null) =>
    act(() =>
      view.result.current.handleDragEnd({
        active: { id },
        over: overId === null ? null : { id: overId },
      } as unknown as DragEndEvent)
    );

  return { ...view, onReorder, drag, drop };
}

describe("useListDnd", () => {
  it("hands the Stores back their own rows after a drop that writes nothing", () => {
    const { result, onReorder, drag, drop } = render();

    drag("milk");
    expect(result.current.arranged).toEqual({ unsorted: ["milk", "bread"] });

    drop("milk", null);
    expect(onReorder).not.toHaveBeenCalled();
    expect(result.current.arranged).toBeNull();
  });

  it("shows a drop's arrangement until the list it wrote comes back", () => {
    const { result, rerender, onReorder, drag, drop } = render();

    drag("milk");
    drop("milk", "bread");
    expect(onReorder).toHaveBeenCalledOnce();
    expect(result.current.arranged).not.toBeNull();

    rerender({ source: {} });
    expect(result.current.arranged).toBeNull();
  });
});
