import type { PlannedItemFromQuery } from "@norish/shared/contracts";

/** The classes that give a day card its measures; `DAY_CARD` below adds them up, and a test keeps the two equal. */
export const DAY_CARD_CLASS = {
  card: "pt-0.5 pb-1.5",
  header: "h-[50px]",
  slot: "gap-2 border-t py-2.5",
  slotLabel: "h-4",
  row: "h-10",
  skeleton: "h-[143px]",
} as const;

/** The day card's fixed measures in points, as the classes above say them. */
export const DAY_CARD = {
  header: 50,
  top: 2,
  bottom: 6,
  /** What a slot adds: its rule, its padding above and below, its label. */
  slot: 1 + 10 + 10 + 16,
  /** One planned row and the gap above it. */
  row: 40 + 8,
  /** Between two cards in a list. */
  gap: 12,
} as const;

/** A day card's height, from how many planned items each of its slots holds. */
export function dayCardHeight(items: readonly Pick<PlannedItemFromQuery, "slot">[]) {
  const perSlot = new Map<string, number>();

  for (const { slot } of items) perSlot.set(slot, (perSlot.get(slot) ?? 0) + 1);

  let height = DAY_CARD.top + DAY_CARD.header + DAY_CARD.bottom;

  for (const count of perSlot.values()) height += DAY_CARD.slot + count * DAY_CARD.row;

  return height;
}

/** Each day card's top edge in a list that keeps `DAY_CARD.gap` between them, after `start` points. */
export function dayCardOffsets(heights: readonly number[], start: number) {
  let offset = start;

  return heights.map((height) => {
    const top = offset;

    offset += height + DAY_CARD.gap;

    return top;
  });
}
