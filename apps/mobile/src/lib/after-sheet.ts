import { useEffect, useLayoutEffect } from "react";

/** The navigation waiting for a root sheet to finish leaving. */
let pending: (() => void) | null = null;
/** A close asked for mid-presentation: UIKit would only start it once the presentation ends. */
let waitingClose: (() => void) | null = null;
let presenting = false;

/** A root sheet's mount: it presents until the root stack's next finished transition. */
export function useSheetPresenting() {
  useLayoutEffect(() => {
    presenting = true;
  }, []);
}

/** Closes the sheet with `close` once it has finished presenting, and runs `open` once it has
 * gone; false, doing nothing, while one already waits. */
export function openAfterSheet(close: () => void, open: () => void): boolean {
  if (pending) return false;
  pending = open;
  if (presenting) waitingClose = close;
  else close();

  return true;
}

/** The root stack's `onFinishTransitioning`: ends a presentation, else runs what waits, once;
 * unmounting the stack drops it. */
export function useSheetExit() {
  useEffect(
    () => () => {
      pending = null;
      waitingClose = null;
      presenting = false;
    },
    []
  );

  return () => {
    if (presenting) {
      const close = waitingClose;

      presenting = false;
      waitingClose = null;
      close?.();

      return;
    }
    const open = pending;

    pending = null;
    open?.();
  };
}
