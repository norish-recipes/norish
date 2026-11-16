import { useEffect, useState } from "react";

/** How long the pill's content takes to fade, so no copy of it shows while its host moves. */
export const HIDE_MS = 100;
/** Long enough for the host to take its grown size before the list is drawn in it. */
export const GROW_MS = 100;
/** Past the app's spring and Reduce Motion's fade, so the list has shrunk back before the host does. */
export const SETTLE_MS = 500;

/** When a morphing host's frame is `large` and when its open state is `drawn`: the frame must not
 * change while SwiftUI animates, or a removed shape keeps the old frame's place as a ghost. */
export function useMorphFrame(open: boolean) {
  const [large, setLarge] = useState(open);
  const [drawn, setDrawn] = useState(open);
  const [was, setWas] = useState(open);

  if (was !== open) {
    setWas(open);
    if (!open) setDrawn(false);
  }

  useEffect(() => {
    if (!open) {
      const shrink = setTimeout(() => setLarge(false), SETTLE_MS);

      return () => clearTimeout(shrink);
    }

    const grow = setTimeout(() => setLarge(true), HIDE_MS);
    const draw = setTimeout(() => setDrawn(true), HIDE_MS + GROW_MS);

    return () => {
      clearTimeout(grow);
      clearTimeout(draw);
    };
  }, [open]);

  return { large, drawn };
}
