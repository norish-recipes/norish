import type { Slot } from "@/components/drag-list/drop-target";
import type { DragRow } from "@/components/drag-list/resolve-drop";
import {
  dropAt,
  gapAt,
  landingTop,
  placeAt,
  sectionBox,
  sectionsOf,
  shiftOf,
  targetAt,
} from "@/components/drag-list/drop-target";
import { describe, expect, it } from "vitest";

import { releaseModule } from "../release-module";

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
  it("gives the gap and its section", () => {
    // Pointed at b1's bottom half.
    expect(targetAt(slots, 240)).toEqual({ gap: 5, section: "B" });
  });

  it("snaps back above the first heading", () => {
    const aboveSlots: Slot[] = [
      { ...slots[1]!, top: -50, heading: false, section: null },
      ...slots,
    ];

    expect(targetAt(aboveSlots, -40)).toBeNull();
  });

  it("makes a list without headings one section", () => {
    const flatSlots: Slot[] = [slots[1]!, slots[2]!].map((slot) => ({ ...slot!, section: "" }));

    expect(targetAt(flatSlots, 140)).toEqual({ gap: 2, section: "" });
  });
});

describe("placeAt and shiftOf", () => {
  const own = (index: number) => ({ top: index * 50, height: 50 });
  const shiftedOrder = (from: number, gap: number) => {
    const place = placeAt(slots, gap, from, own(from));

    return rows
      .map((row, index) => ({ key: row.key, top: slots[index]!.top + shiftOf(index, place) }))
      .sort((a, b) => a.top - b.top)
      .map((row) => row.key);
  };

  it("moves the after-image to where it lands and the rows between out of its way", () => {
    expect(placeAt(slots, 5, 1, own(1))).toEqual({ from: 1, gap: 5, height: 50, offset: 150 });
    expect(placeAt(slots, 1, 4, own(4))).toEqual({ from: 4, gap: 1, height: 50, offset: -150 });
    expect([0, 1, 2, 3, 4, 5].map((index) => shiftOf(index, placeAt(slots, 5, 1, own(1))))).toEqual(
      [0, 150, -50, -50, -50, 0]
    );
    expect([0, 1, 2, 3, 4, 5].map((index) => shiftOf(index, placeAt(slots, 1, 4, own(4))))).toEqual(
      [0, 50, 50, 50, -150, 0]
    );
  });

  it("shows the rows in the order the drop commits", () => {
    for (const [from, gap] of [
      [1, 5],
      [1, 6],
      [4, 1],
      [2, 4],
    ] as const) {
      expect(shiftedOrder(from, gap)).toEqual(dropAt(rows, from, gap)?.rows.map((row) => row.key));
    }
  });

  it("moves nothing where it lands in place, snaps back, or lands with neither side drawn", () => {
    const drawn = slots.map((slot, index) => (index === 3 || index === 4 ? null : slot));

    expect(placeAt(slots, 1, 1, own(1))).toBeNull();
    expect(placeAt(slots, 2, 1, own(1))).toBeNull();
    expect(placeAt(slots, null, 1, own(1))).toBeNull();
    expect(placeAt(drawn, 4, 1, own(1))).toBeNull();
    expect(shiftOf(2, null)).toBe(0);
  });

  it("reaches landingTop as the worklets plugin builds it, which captures it when placeAt is defined", () => {
    const built = releaseModule<{ placeAt: typeof placeAt }>(
      new URL("../../src/components/drag-list/drop-target.ts", import.meta.url).pathname,
      { "./resolve-drop": {} }
    );

    expect(built.placeAt(slots, 5, 1, own(1))).toEqual({
      from: 1,
      gap: 5,
      height: 50,
      offset: 150,
    });
  });
});

describe("sectionBox", () => {
  const own = (index: number) => ({ top: index * 50, height: 50 });

  it("outlines the section's cards where they moved, with the after-image in it", () => {
    // a1 placed under b1: B's heading and b1 move up a row, a1 sits below them.
    expect(sectionBox(slots, "B", 1, placeAt(slots, 5, 1, own(1)))).toEqual({
      top: 110,
      height: 140,
      x: 20,
      width: 300,
    });
  });

  it("leaves out a held row that is not placed in the section", () => {
    expect(sectionBox(slots, "B", 1, null)).toEqual({ top: 160, height: 90, x: 20, width: 300 });
    expect(sectionBox(slots, "A", 1, null)).toEqual({ top: 10, height: 140, x: 20, width: 300 });
  });

  it("outlines nothing in a list without headings", () => {
    expect(sectionBox(slots, "", 1, null)).toBeNull();
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
  const gapOf = (y: number) => targetAt(slots, y)?.gap ?? null;

  it("lands where the rows close up behind the row, or make room in front", () => {
    expect(landingTop(slots, gapOf(240), 1, own(1))).toBe(200);
    expect(landingTop(slots, gapOf(60), 4, own(4))).toBe(50);
  });

  it("goes back to its own place when it lands in place or snaps back", () => {
    expect(landingTop(slots, null, 4, own(4))).toBe(200);
    expect(landingTop(slots, gapOf(60), 1, own(1))).toBe(50);
  });

  it("lands under the last drawn row when the finger is past the rendered rows", () => {
    // Rows 3 and 4 left the window; the held row (5) is still drawn.
    const drawn = slots.map((slot, index) => (index === 3 || index === 4 ? null : slot));
    const gap = gapAt(drawn, 160);

    expect(gap).toBe(3);
    expect(landingTop(drawn, gap, 5, own(5))).toBe(150);
  });

  it("has no top for a ruled gap with neither side drawn", () => {
    // Calendar's `landAt` gap 4, between rows 3 and 4, which left the window.
    const drawn = slots.map((slot, index) => (index === 3 || index === 4 ? null : slot));

    expect(landingTop(drawn, 4, 1, own(1))).toBeNull();
  });

  it("goes back to the held row's own top after its cell left the window", () => {
    const drawn = slots.map((slot, index) => (index === 4 ? null : slot));

    expect(landingTop(drawn, null, 4, own(4))).toBe(200);
  });
});
