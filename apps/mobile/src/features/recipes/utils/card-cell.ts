import type { ViewStyle } from "react-native";

/** A grid card's height in pt, the same as the cards' own `h-[286px]`. */
export const GRID_CARD_HEIGHT = 286;
/** The space around a card, in pt. */
const GAP = 12;
/** The list's side padding, in pt (`px-5`). */
const SIDE = 20;

/**
 * The place of the card at `index`: a row of the list, or in a grid the left or right half of its
 * line. A grid card is a list cell of its own, the right one lifted into the line of the card
 * before it, so each card keeps its identity as the cards around it come and go.
 */
export function cardCell(isGrid: boolean, index: number): ViewStyle {
  if (!isGrid) return { paddingHorizontal: SIDE, paddingBottom: GAP };

  const right = index % 2 === 1;

  return {
    flexDirection: "row",
    width: "50%",
    paddingLeft: right ? GAP / 2 : SIDE,
    paddingRight: right ? SIDE : GAP / 2,
    paddingBottom: GAP,
    marginLeft: right ? "50%" : 0,
    marginTop: right ? -(GRID_CARD_HEIGHT + GAP) : 0,
  };
}
