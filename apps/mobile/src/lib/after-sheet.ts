import { useEffect } from "react";

/** The navigation waiting for a root sheet to finish leaving. */
let pending: (() => void) | null = null;

/** Holds `open` until the root stack's modal transition ends; false, holding nothing, when one already waits. */
export function openAfterSheet(open: () => void): boolean {
  if (pending) return false;
  pending = open;

  return true;
}

/** The root stack's `onFinishTransitioning`: runs what waits, once; unmounting the stack drops it. */
export function useSheetExit() {
  useEffect(
    () => () => {
      pending = null;
    },
    []
  );

  return () => {
    const open = pending;

    pending = null;
    open?.();
  };
}
