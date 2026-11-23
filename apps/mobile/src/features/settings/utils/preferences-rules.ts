import { HIDDEN_ITEMS, partitionHiddenItems } from "@norish/shared-react/reader";

type HiddenItem = (typeof HIDDEN_ITEMS)[number];

/** The stored list with `item` flipped; a stored name that is not on offer is carried through. */
export function toggledHiddenItems(
  stored: readonly string[],
  offered: readonly HiddenItem[],
  item: HiddenItem
) {
  const { selected, carried } = partitionHiddenItems(stored, offered);
  const next = selected.includes(item)
    ? selected.filter((chosen) => chosen !== item)
    : [...selected, item];

  return [...offered.filter((offer) => next.includes(offer)), ...carried];
}
