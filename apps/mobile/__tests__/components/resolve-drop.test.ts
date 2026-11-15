import type { DragRow } from "@/components/drag-list/resolve-drop";
import { resolveDrop } from "@/components/drag-list/resolve-drop";
import { describe, expect, it } from "vitest";

const heading = (key: string): DragRow<string, string> => ({ kind: "heading", key, value: key });
const item = (key: string): DragRow<string, string> => ({ kind: "item", key, value: key });
const rowKeys = (rows: DragRow<string, string>[]) => rows.map((r) => r.key);

describe("resolveDrop", () => {
  const rows = [heading("A"), item("a1"), item("a2"), heading("B"), item("b1")];

  it("reports the heading above a row moved under another heading", () => {
    const drop = resolveDrop(rows, 1, 3);

    expect(rowKeys(drop!.rows)).toEqual(["A", "a2", "B", "a1", "b1"]);
    expect(drop).toMatchObject({ item: "a1", heading: "B" });
  });

  it("keeps the heading for a reorder inside one section", () => {
    expect(resolveDrop(rows, 1, 2)).toMatchObject({ item: "a1", heading: "A" });
  });

  it("reports no heading above the first heading", () => {
    expect(resolveDrop(rows, 1, 0)).toMatchObject({ item: "a1", heading: null });
  });

  it("ignores a heading row", () => {
    expect(resolveDrop(rows, 0, 2)).toBeNull();
  });
});
