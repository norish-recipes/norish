import type { RefObject } from "react";
import { useEffect, useState } from "react";

type Row = { close: () => void };

// Module scope: one list shows at a time and one row is open in it.
let open: Row | null = null;

/** Closes the open swipe row, if any: on a scroll, a touch elsewhere, a press on the accessory or
 * the Library losing focus. `except` is the row the touch landed in. */
export function closeOpenRow(except?: Row) {
  if (open && open !== except) open.close();
}

function release(row: Row) {
  if (open === row) open = null;
}

/** A swipe row's claim on being the open one. Opening closes the previous row; the claim is
 * released when the row closes or unmounts, so a stale row is never kept. */
export function useOpenRow(ref: RefObject<Row | null>) {
  const [row] = useState<Row>(() => ({ close: () => ref.current?.close() }));

  useEffect(() => () => release(row), [row]);

  return {
    opened() {
      closeOpenRow(row);
      open = row;
    },
    closed: () => release(row),
    /** A touch on this row closes any other open one. */
    touched: () => closeOpenRow(row),
  };
}
