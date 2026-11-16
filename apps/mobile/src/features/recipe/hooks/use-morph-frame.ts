import { useEffect, useState } from "react";

/** The timer pill's morph into its list and back, in ms from the tap. */
export const MORPH = {
  /** The pill's content fades, so no copy of it shows while its host moves. */
  hide: 100,
  /** The host takes its grown size before the list is drawn in it. */
  grow: 100,
  /** The rows show once the glass has grown most of the way, so none hangs outside it. */
  contentDelay: 240,
  /** On a close, the countdown returns once the small host has replaced the large one. */
  pillReturn: 50,
  /** A closing list has shrunk back into the pill, for what it covered to return. */
  listShrunk: 400,
  /** Past the app's spring, so the list has shrunk back before the host does. */
  settle: 500,
} as const;

/** When a morphing host's frame is `large` and when its open state is `drawn`: the frame must not
 * change while SwiftUI animates, or a removed shape keeps the old frame's place as a ghost. */
export function useMorphFrame(open: boolean, settleMs: number = MORPH.settle) {
  const [large, setLarge] = useState(open);
  const [drawn, setDrawn] = useState(open);
  const [was, setWas] = useState(open);

  if (was !== open) {
    setWas(open);
    if (!open) setDrawn(false);
  }

  useEffect(() => {
    if (!open) {
      const shrink = setTimeout(() => setLarge(false), settleMs);

      return () => clearTimeout(shrink);
    }

    const grow = setTimeout(() => setLarge(true), MORPH.hide);
    const draw = setTimeout(() => setDrawn(true), MORPH.hide + MORPH.grow);

    return () => {
      clearTimeout(grow);
      clearTimeout(draw);
    };
  }, [open, settleMs]);

  return { large, drawn };
}
