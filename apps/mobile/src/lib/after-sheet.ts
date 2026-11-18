import { useEffect, useId, useLayoutEffect } from "react";

/** A row's tap: `close` the sheet, then `open` once that sheet has gone. */
type Wait = { sheet: string; close: () => void; open: () => void; closed: boolean; gone: boolean };

let waiting: Wait | null = null;
/** The sheet whose presentation has not finished: UIKit would only start a close once it ends. */
let presenting: string | null = null;

function sheetMounted(sheet: string) {
  presenting = sheet;
}

/** A sheet closed by us goes on to its dismissal; one swiped or replaced first drops its tap. */
function sheetUnmounted(sheet: string) {
  if (presenting === sheet) presenting = null;
  if (waiting?.sheet !== sheet) return;
  if (waiting.closed) waiting.gone = true;
  else waiting = null;
}

/** A root sheet's mount: it presents until the root stack's next finished transition. Returns the
 * id `openAfterSheet` ties a tap to. */
export function useSheetPresenting(): string {
  const sheetId = useId();

  useLayoutEffect(() => {
    sheetMounted(sheetId);

    return () => sheetUnmounted(sheetId);
  }, [sheetId]);

  return sheetId;
}

/** Closes `sheet` with `close` once it has finished presenting, and runs `open` once it has gone;
 * false, doing nothing, while a tap already waits. */
export function openAfterSheet(sheet: string, close: () => void, open: () => void): boolean {
  if (waiting) return false;
  waiting = { sheet, close, open, closed: presenting !== sheet, gone: false };
  if (waiting.closed) close();

  return true;
}

/** The root stack's finished transition: ends a presentation, else, once the sheet has unmounted,
 * its dismissal. Not a hook's closure: React Compiler 1.0 folds a read-then-clear of module state there. */
function transitionFinished() {
  const wait = waiting;

  if (presenting) {
    const sheet = presenting;

    presenting = null;
    if (wait?.sheet === sheet && !wait.closed) {
      wait.closed = true;
      wait.close();
    }

    return;
  }
  if (!wait?.gone) return;
  waiting = null;
  wait.open();
}

function reset() {
  waiting = null;
  presenting = null;
}

/** The root stack's `onFinishTransitioning`; unmounting the stack drops what waits. */
export function useSheetExit() {
  useEffect(() => reset, []);

  return transitionFinished;
}
