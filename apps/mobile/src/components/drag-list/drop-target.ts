import type { DragRow, Drop } from "./resolve-drop";
import { resolveDrop } from "./resolve-drop";

/** A vertical extent in the list's content. */
export type Span = { top: number; height: number };
/** A view's frame in its parent. */
export type Box = Span & { x: number; width: number };

/** A laid-out row in the list's content: its cell, and the card drawn in it (`card` is relative to
 * the cell's top). Null for a row not on screen. */
export type Slot =
  | (Span & {
      heading: boolean;
      /** The row's section: see `sectionsOf`. */
      section: string | null;
      card: Box;
    })
  | null;

/** Where a held row would land. `gap` is the index in the rows it lands before; `line` and `box` are
 * the drop line and the section's outline in the content. */
export type Target = {
  gap: number;
  section: string;
  line: { y: number; x: number; width: number } | null;
  box: Box | null;
};

/** Each row's section: a heading's from `sectionOf` (its key by default), an item's from the heading above it. Rows above
 * the first heading have none (a drop there snaps back); a list without headings is one section. */
export function sectionsOf<H, T>(
  rows: readonly DragRow<H, T>[],
  sectionOf: (heading: H, key: string) => string | null = (_heading, key) => key
): (string | null)[] {
  let current: string | null = rows.some((row) => row.kind === "heading") ? null : "";

  return rows.map((row) => {
    if (row.kind === "heading") current = sectionOf(row.value, row.key);

    return current;
  });
}

/** The gap a finger at content `y` points at: a heading takes the row into its section, under it;
 * an item's top half puts it above, its bottom half below. Null with nothing laid out. */
export function gapAt(slots: readonly Slot[], y: number): number | null {
  "worklet";
  let gap: number | null = null;

  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];

    if (!slot) continue;
    if (y < slot.top) return gap ?? index;
    if (y < slot.top + slot.height) {
      return slot.heading || y >= slot.top + slot.height / 2 ? index + 1 : index;
    }
    gap = index + 1;
  }

  return gap;
}

/** The section a gap is in, the one of the row above it; null where a drop snaps back. */
export function sectionAt(sections: readonly (string | null)[], gap: number) {
  "worklet";

  if (gap > 0) return sections[gap - 1] ?? null;

  return sections[0] === "" ? "" : null;
}

/** What a finger at content `y` targets while the row at `from` is held: the line under the row
 * above the gap (else over the row below), none where it would land in place, and the outline
 * around the section's laid-out cards. */
export function targetAt(
  slots: readonly Slot[],
  sections: readonly (string | null)[],
  from: number,
  y: number
): Target | null {
  "worklet";
  const gap = gapAt(slots, y);
  const section = gap === null ? null : sectionAt(sections, gap);

  if (gap === null || section === null) return null;

  const above = slots[gap - 1];
  const below = slots[gap];
  const inPlace = gap === from || gap === from + 1;
  const edge = above
    ? {
        y: above.top + above.card.top + above.card.height,
        x: above.card.x,
        width: above.card.width,
      }
    : below
      ? { y: below.top + below.card.top, x: below.card.x, width: below.card.width }
      : null;
  const line = inPlace ? null : edge;
  let box: Target["box"] = null;

  if (section !== "") {
    for (const slot of slots) {
      if (!slot || slot.section !== section) continue;
      const top = Math.min(box?.top ?? Infinity, slot.top + slot.card.top);
      const bottom = Math.max(
        box ? box.top + box.height : -Infinity,
        slot.top + slot.card.top + slot.card.height
      );

      box = { top, height: bottom - top, x: slot.card.x, width: slot.card.width };
    }
  }

  return { gap, section, line, box };
}

/** The drop of the row at `from` into `gap`; null when it lands where it was. */
export function dropAt<H, T>(rows: DragRow<H, T>[], from: number, gap: number): Drop<H, T> | null {
  const to = gap > from ? gap - 1 : gap;

  return to === from ? null : resolveDrop(rows, from, to);
}

/** Where the held row's cell top lands for `gap`, in the content as it is now: rows between close
 * up behind it, or make room in front. `own` is where it was, its top when it lands in place. */
export function landingTop(slots: readonly Slot[], gap: number | null, from: number, own: Span) {
  "worklet";
  if (gap === null || gap === from || gap === from + 1) return own.top;
  // The gap is next to a drawn row (see `gapAt`): the edge between the two rows either side.
  const above = slots[gap - 1];
  const below = slots[gap];
  const edge = above ? above.top + above.height : below ? below.top : null;

  if (edge === null) return own.top;

  return gap > from ? edge - own.height : edge;
}
