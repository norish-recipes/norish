import type { Slot } from "@/components/drag-list/drop-target";
import type { DragRow } from "@/components/drag-list/resolve-drop";
import {
  dropAt,
  gapAt,
  landingTop,
  sectionsOf,
  targetAt,
} from "@/components/drag-list/drop-target";
import { describe, expect, it } from "vitest";

const heading = (key: string): DragRow<string, string> => ({ kind: "heading", key, value: key });
const item = (key: string): DragRow<string, string> => ({ kind: "item", key, value: key });

// Store A (a1, a2), Store B (b1), empty Store C: 50 pt rows, each card inset 20 pt with a 10 pt
// gap above a heading's card.
const rows = [heading("A"), item("a1"), item("a2"), heading("B"), item("b1"), heading("C")];
const sections = sectionsOf(rows, (value) => value);
const slots: Slot[] = rows.map((row, index) => ({
  top: index * 50,
  height: 50,
  heading: row.kind === "heading",
  section: sections[index] ?? null,
  card: {
    top: row.kind === "heading" ? 10 : 0,
    height: row.kind === "heading" ? 40 : 50,
    x: 20,
    width: 300,
  },
}));

describe("sectionsOf", () => {
  it("gives each item its heading's section, and none above the first heading", () => {
    expect(sectionsOf([item("x"), ...rows], (value) => value)).toEqual([
      null,
      "A",
      "A",
      "A",
      "B",
      "B",
      "C",
    ]);
  });

  it("lets a heading close a section, so rows under it take no drop", () => {
    expect(sectionsOf(rows, (value) => (value === "B" ? null : value))).toEqual([
      "A",
      "A",
      "A",
      null,
      null,
      "C",
    ]);
  });

  it("makes a list without headings one section", () => {
    expect(sectionsOf([item("x"), item("y")], () => "never")).toEqual(["", ""]);
  });
});

describe("gapAt", () => {
  it("puts the row above an item from its top half and below it from its bottom half", () => {
    expect(gapAt(slots, 60)).toBe(1);
    expect(gapAt(slots, 90)).toBe(2);
  });

  it("drops into a heading's section, under it, wherever the heading is pointed at", () => {
    expect(gapAt(slots, 155)).toBe(4);
    expect(gapAt(slots, 195)).toBe(4);
    // An empty (or folded) section is only its heading.
    expect(gapAt(slots, 260)).toBe(6);
  });

  it("skips rows that are not laid out and reads past the ends", () => {
    const windowed = slots.map((slot, index) => (index < 2 ? null : slot));

    expect(gapAt(windowed, 0)).toBe(2);
    expect(gapAt(slots, 900)).toBe(6);
    expect(gapAt([null, null], 10)).toBeNull();
  });
});

describe("targetAt", () => {
  it("draws the line under the row above the gap and outlines the section's cards", () => {
    // a1 held, pointed at b1's bottom half.
    expect(targetAt(slots, sections, 1, 240)).toEqual({
      gap: 5,
      section: "B",
      line: { y: 250, x: 20, width: 300 },
      box: { top: 160, height: 90, x: 20, width: 300 },
    });
  });

  it("draws no line where the row would land in place", () => {
    expect(targetAt(slots, sections, 1, 60)?.line).toBeNull();
    expect(targetAt(slots, sections, 1, 90)?.line).toBeNull();
  });

  it("snaps back above the first heading", () => {
    const above = [item("x"), ...rows];
    const aboveSlots: Slot[] = [
      { ...slots[1]!, top: -50, heading: false, section: null },
      ...slots,
    ];

    expect(
      targetAt(
        aboveSlots,
        sectionsOf(above, (value) => value),
        2,
        -40
      )
    ).toBeNull();
  });

  it("outlines nothing in a list without headings", () => {
    const flat = [item("x"), item("y")];
    const flatSlots: Slot[] = [slots[1]!, slots[2]!].map((slot) => ({ ...slot!, section: "" }));

    expect(
      targetAt(
        flatSlots,
        sectionsOf(flat, () => null),
        0,
        140
      )
    ).toMatchObject({
      gap: 2,
      section: "",
      box: null,
    });
  });
});

describe("dropAt", () => {
  it("moves the row into the gap, counted before it was taken out", () => {
    const drop = dropAt(rows, 1, 5);

    expect(drop?.rows.map((row) => row.key)).toEqual(["A", "a2", "B", "b1", "a1", "C"]);
    expect(drop).toMatchObject({ item: "a1", heading: "B" });
    expect(dropAt(rows, 4, 1)).toMatchObject({ item: "b1", heading: "A" });
  });

  it("lands in an empty section under its heading", () => {
    expect(dropAt(rows, 1, 6)?.rows.map((row) => row.key)).toEqual([
      "A",
      "a2",
      "B",
      "b1",
      "C",
      "a1",
    ]);
  });

  it("is no drop where it was", () => {
    expect(dropAt(rows, 1, 1)).toBeNull();
    expect(dropAt(rows, 1, 2)).toBeNull();
  });
});

describe("landingTop", () => {
  const own = (index: number) => ({ top: index * 50, height: 50 });
  const gapOf = (from: number, y: number) => targetAt(slots, sections, from, y)?.gap ?? null;

  it("lands where the rows close up behind the row, or make room in front", () => {
    expect(landingTop(slots, gapOf(1, 240), 1, own(1))).toBe(200);
    expect(landingTop(slots, gapOf(4, 60), 4, own(4))).toBe(50);
  });

  it("goes back to its own place when it lands in place or snaps back", () => {
    expect(landingTop(slots, null, 4, own(4))).toBe(200);
    expect(landingTop(slots, gapOf(1, 60), 1, own(1))).toBe(50);
  });

  it("lands under the last drawn row when the finger is past the rendered rows", () => {
    // Rows 3 and 4 left the window; the held row (5) is still drawn.
    const window = slots.map((slot, index) => (index === 3 || index === 4 ? null : slot));
    const gap = gapAt(window, 160);

    expect(gap).toBe(3);
    expect(landingTop(window, gap, 5, own(5))).toBe(150);
  });

  it("goes back to the held row's own top after its cell left the window", () => {
    const window = slots.map((slot, index) => (index === 4 ? null : slot));

    expect(landingTop(window, null, 4, own(4))).toBe(200);
  });
});
