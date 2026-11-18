import { useEffect, useId, useLayoutEffect, useSyncExternalStore } from "react";

/** A row's tap: `close` the sheet, then `open` once that sheet has gone. */
type Wait = { sheet: string; close: () => void; open: () => void; closed: boolean; gone: boolean };

let waiting: Wait | null = null;
const listeners = new Set<() => void>();

/** Every change to `waiting` goes through here, so the touch shield hears each one. */
function setWaiting(next: Wait | null) {
  waiting = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

const isWaiting = () => waiting !== null;

/** True from a tap that queued an open until that open runs or is dropped. */
export function useSheetOpenWaiting(): boolean {
  return useSyncExternalStore(subscribe, isWaiting);
}
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
  else setWaiting(null);
}

/** A sheet's mount: it presents until its stack's next finished transition. Returns the id
 * `openAfterSheet` ties a tap to. */
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
  const wait = { sheet, close, open, closed: presenting !== sheet, gone: false };

  setWaiting(wait);
  if (wait.closed) close();

  return true;
}

/** A sheet stack's finished transition: ends a presentation, else, once the sheet has unmounted,
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
  setWaiting(null);
  wait.open();
}

function reset() {
  setWaiting(null);
  presenting = null;
}

/** A stack's `onFinishTransitioning` for the sheets it presents; unmounting it drops what waits. */
export function useSheetExit() {
  useEffect(() => reset, []);

  return transitionFinished;
}
