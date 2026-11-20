// @vitest-environment jsdom
import type { DragRow, Drop } from "@/components/drag-list/resolve-drop";
import { useHeldRows } from "@/components/drag-list/use-held-rows";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const heading = (key: string): DragRow<string, string> => ({ kind: "heading", key, value: key });
const item = (key: string): DragRow<string, string> => ({ kind: "item", key, value: key });
const keys = (rows: DragRow<string, string>[]) => rows.map((row) => row.key);

function render(keep: boolean | void = undefined) {
  const onDrop = vi.fn((_drop: Drop<string, string>) => keep);
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

    act(() => void result.current.drop("a1", 3));
    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ item: "a1", heading: "A" }));
  });

  it("finds the lifted row by its key when the rows changed before the lift reached React", () => {
    const { result, rerender, onDrop } = render();

    // The hold saw a1 at 1; a line lands above it before the lift is told.
    rerender({ rows: [heading("A"), item("new"), item("a1"), item("a2")] });
    act(() => result.current.lift());
    act(() => void result.current.drop("a1", 4));
    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ item: "a1" }));
    expect(keys(onDrop.mock.calls[0]?.[0].rows ?? [])).toEqual(["A", "new", "a2", "a1"]);
  });

  it("shows a kept drop until the rows change", () => {
    const { result, rerender } = render();
    const written = [heading("A"), item("a2"), item("a1")];

    act(() => result.current.lift());
    act(() => void result.current.drop("a1", 3));
    expect(keys(result.current.shown)).toEqual(["A", "a2", "a1"]);

    rerender({ rows: written });
    expect(result.current.shown).toBe(written);
  });

  it("shows the rows again when the drop is refused", () => {
    const { result } = render(false);

    act(() => result.current.lift());
    act(() => void result.current.drop("a1", 3));
    expect(keys(result.current.shown)).toEqual(["A", "a1", "a2"]);
  });

  it("lets the rows through again after a drag that ended where it began", () => {
    const { result, rerender, onDrop } = render();
    const changed = [heading("A"), item("a2")];

    act(() => result.current.lift());
    act(() => void result.current.drop("a1", 2));
    expect(onDrop).not.toHaveBeenCalled();
    rerender({ rows: changed });
    expect(result.current.shown).toBe(changed);
  });
});
