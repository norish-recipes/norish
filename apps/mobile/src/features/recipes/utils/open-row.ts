type Row = { close: () => void };

// Module scope: one list shows at a time and one row is open in it; a row leaves this when it
// closes or unmounts, so a stale ref is never kept.
let open: Row | null = null;

/** The one swipe row that is open: opening another, a scroll or a touch elsewhere closes it. */
export const openRow = {
  opened(row: Row) {
    if (open && open !== row) open.close();
    open = row;
  },
  closed(row: Row) {
    if (open === row) open = null;
  },
  /** Closes the open row, if any; `except` is the row the touch landed in. */
  closeOpen(except?: Row) {
    if (open && open !== except) open.close();
  },
};

/** How far a card is dragged for the swipe to open on release, in pt. */
export const OPEN_THRESHOLD = 40;

/** Whether a drag of `translation` has reached the point where a release opens the row. */
export function pastOpenThreshold(translation: number) {
  "worklet";

  return Math.abs(translation) >= OPEN_THRESHOLD;
}
