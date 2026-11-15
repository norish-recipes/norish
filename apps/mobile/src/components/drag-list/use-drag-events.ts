import type { ReorderableListReorderEvent } from "react-native-reorderable-list";
import { useEffect, useRef, useState } from "react";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";

import type { HeldRows } from "./use-held-rows";

const mediumImpact = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

/** The library's drag events, built once (it rebuilds every row's drag handler when they change):
 * each lift, drop and settle reaches the held rows, then the host's `onHeldChange`. */
export function useDragEvents<H, T>(held: HeldRows<H, T>, onHeldChange?: (held: boolean) => void) {
  const latestRef = useRef({ held, onHeldChange });

  useEffect(() => {
    latestRef.current = { held, onHeldChange };
  });

  const [events] = useState(() => {
    const told = (isHeld: boolean) => latestRef.current.onHeldChange?.(isHeld);
    const lift = () => {
      latestRef.current.held.lift();
      told(true);
    };
    const settle = () => {
      latestRef.current.held.settle();
      told(false);
    };

    return {
      onDragStart: () => {
        "worklet";
        scheduleOnRN(mediumImpact);
        scheduleOnRN(lift);
      },
      onDragEnd: ({ from, to }: { from: number; to: number }) => {
        "worklet";
        scheduleOnRN(mediumImpact);
        // A move lands in onReorder once the row has settled.
        if (from === to) scheduleOnRN(settle);
      },
      onReorder: ({ from, to }: ReorderableListReorderEvent) => {
        latestRef.current.held.drop(from, to);
        told(false);
      },
    };
  });

  return events;
}
