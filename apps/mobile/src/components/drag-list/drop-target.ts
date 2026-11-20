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

/** Where a held row would land: `gap` is the index in the rows it lands before. */
export type Target = { gap: number; section: string };

/** Where the held row's after-image sits while carried: the row at `from` moves by `offset`, and
 * the rows between it and `gap` move by `height` the other way to make room. */
export type Place = { from: number; gap: number; height: number; offset: number };

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

/** The section a gap is in, the one of the row above it; null where a drop snaps back. Without a
 * drawn row above, an item below shares its section and a heading below gives none. */
function sectionAt(slots: readonly Slot[], gap: number) {
  "worklet";
  const above = slots[gap - 1];
  const below = slots[gap];

  if (above) return above.section;

  return below && !below.heading ? below.section : null;
}

/** What a finger at content `y` targets: the gap and its section. Counted in the rows as laid
 * out, never as shifted, so the target can't chase the rows it moves. */
export function targetAt(slots: readonly Slot[], y: number): Target | null {
  "worklet";
  const gap = gapAt(slots, y);
  const section = gap === null ? null : sectionAt(slots, gap);

  return gap === null || section === null ? null : { gap, section };
}

/** How far the row at `index` is moved while the held row sits at `place`. */
export function shiftOf(index: number, place: Place | null) {
  "worklet";
  if (!place) return 0;
  const { from, gap, height, offset } = place;

  if (index === from) return offset;
  if (gap > from && index > from && index < gap) return -height;
  if (gap < from && index >= gap && index < from) return height;

  return 0;
}

// Above placeAt: a worklet captures what it calls as it is defined, so callees go first.
/** Where the held row's cell top lands for `gap`, in the content as it is now: rows between close
 * up behind it, or make room in front. `own` is where it was, its top when it lands in place. */
export function landingTop(slots: readonly Slot[], gap: number | null, from: number, own: Span) {
  "worklet";
  if (gap === null || gap === from || gap === from + 1) return own.top;
  // The edge between the rows either side; null when neither is drawn, as a `landAt` gap can be.
  const above = slots[gap - 1];
  const below = slots[gap];
  const edge = above ? above.top + above.height : below ? below.top : null;

  if (edge === null) return null;

  return gap > from ? edge - own.height : edge;
}

/** The held row at `from` (laid out at `own`) sitting at `gap`; null where nothing moves: it lands
 * in place, snaps back, or lands where neither side is drawn. */
export function placeAt(
  slots: readonly Slot[],
  gap: number | null,
  from: number,
  own: Span
): Place | null {
  "worklet";
  const top = landingTop(slots, gap, from, own);

  return gap === null || top === null || top === own.top
    ? null
    : { from, gap, height: own.height, offset: top - own.top };
}

/** The outline around a section's drawn cards where they sit, moved by `place`, with the held row's
 * after-image counted in once it is placed. None in a list without headings. */
export function sectionBox(
  slots: readonly Slot[],
  section: string,
  from: number,
  place: Place | null
): Box | null {
  "worklet";
  if (section === "") return null;
  let box: Box | null = null;

  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];

    if (!slot || (slot.section !== section && !(index === from && place))) continue;
    const top = slot.top + shiftOf(index, place) + slot.card.top;
    const upper = Math.min(box?.top ?? Infinity, top);
    const lower = Math.max(box ? box.top + box.height : -Infinity, top + slot.card.height);

    box = { top: upper, height: lower - upper, x: slot.card.x, width: slot.card.width };
  }

  return box;
}

/** The drop of the row at `from` into `gap`; null when it lands where it was. */
export function dropAt<H, T>(rows: DragRow<H, T>[], from: number, gap: number): Drop<H, T> | null {
  const to = gap > from ? gap - 1 : gap;

  return to === from ? null : resolveDrop(rows, from, to);
}
