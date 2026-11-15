import { useRef } from "react";

import type { GrowDirection } from "@norish/shared-react/calendar";

/**
 * Grows the timeline at an edge the list reached, but never under a held row: an edge reached
 * then grows once the row is let go, as the list tells each edge only once per content length.
 */
export function useHeldGrowth(grow: (direction: GrowDirection) => void) {
  const stateRef = useRef({ held: false, missed: new Set<GrowDirection>() });

  return {
    reached: (direction: GrowDirection) => {
      if (stateRef.current.held) stateRef.current.missed.add(direction);
      else grow(direction);
    },
    heldChange: (held: boolean) => {
      const { missed } = stateRef.current;

      stateRef.current.held = held;
      if (held) return;
      for (const direction of missed) grow(direction);
      missed.clear();
    },
  };
}
