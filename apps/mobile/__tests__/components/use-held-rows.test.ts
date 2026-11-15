// @vitest-environment jsdom
import type { DragRow } from "@/components/drag-list/resolve-drop";
import { useHeldRows } from "@/components/drag-list/use-held-rows";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const heading = (key: string): DragRow<string, string> => ({ kind: "heading", key, value: key });
const item = (key: string): DragRow<string, string> => ({ kind: "item", key, value: key });
const keys = (rows: DragRow<string, string>[]) => rows.map((row) => row.key);

function render(keep: boolean | void = undefined) {
  const onDrop = vi.fn(() => keep);
  const view = renderHook(({ rows }) => useHeldRows(rows, onDrop), {
    initialProps: { rows: [heading("A"), item("a1"), item("a2")] },
  });

  return { ...view, onDrop };
}

describe("useHeldRows", () => {
  it("holds the rows still under a lifted row and counts the drop in them", () => {
    const { result, rerender, onDrop } = render();

    act(() => result.current.lift());
    // Another member's line lands above mid-drag.
    rerender({ rows: [heading("A"), item("new"), item("a1"), item("a2")] });
    expect(keys(result.current.shown)).toEqual(["A", "a1", "a2"]);

    act(() => result.current.drop(1, 2));
    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ item: "a1", heading: "A" }));
  });

  it("shows a kept drop until the rows change", () => {
    const { result, rerender } = render();
    const written = [heading("A"), item("a2"), item("a1")];

    act(() => result.current.lift());
    act(() => result.current.drop(1, 2));
    expect(keys(result.current.shown)).toEqual(["A", "a2", "a1"]);

    rerender({ rows: written });
    expect(result.current.shown).toBe(written);
  });

  it("puts the row back when the drop is refused, as a reorder after showing it", () => {
    const rows = [heading("A"), item("a1"), item("a2")];
    const shownEachRender: string[][] = [];
    const { result } = renderHook(() => {
      const held = useHeldRows(rows, () => false);

      shownEachRender.push(keys(held.shown));

      return held;
    });

    act(() => result.current.lift());
    act(() => result.current.drop(1, 2));

    // The list moved the row itself, so it must see the drop before the rows come back.
    expect(shownEachRender.slice(-2)).toEqual([
      ["A", "a2", "a1"],
      ["A", "a1", "a2"],
    ]);
  });

  it("lets the rows through again after a drag that ended where it began", () => {
    const { result, rerender } = render();
    const changed = [heading("A"), item("a2")];

    act(() => result.current.lift());
    act(() => result.current.settle());
    rerender({ rows: changed });
    expect(result.current.shown).toBe(changed);
  });
});
