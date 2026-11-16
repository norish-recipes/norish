import type { PanGesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import { useEffect } from "react";
import { usePanGesture } from "react-native-gesture-handler";
import { cancelAnimation, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import type { StepReach } from "../utils/cook-pager";
import { DRAG_DISTANCE, PEEK_SLOT, settleTarget, springStart } from "../utils/cook-pager";

// Critically damped: a release lands on its step without overshooting into the next.
const SPRING = { damping: 30, stiffness: 260, mass: 1 };

/** What the pan reads and writes, shared by the column's slots. */
export type StepPager = {
  position: SharedValue<number>;
  height: SharedValue<number>;
  scrollAt: SharedValue<number>;
  scrollMax: SharedValue<number>;
  pan: PanGesture;
};

/**
 * The step column's `position`: the step it shows, fractional mid-page. A drag moves it, a
 * release springs it with the finger's velocity; a step change from anywhere else springs too.
 */
export function useStepPager({
  count,
  current,
  still,
  onStepChange,
}: {
  count: number;
  current: number;
  still: boolean;
  onStepChange: (step: number) => void;
}): StepPager {
  const position = useSharedValue(current);
  // The step the last spring ran to, so a release's own step change doesn't restart it.
  const goal = useSharedValue(current);
  const height = useSharedValue(0);
  const scrollAt = useSharedValue(0);
  const scrollMax = useSharedValue(0);
  const dragStart = useSharedValue(0);
  // The translation the drag started paging at; null while the step's text still scrolls.
  const pagingFrom = useSharedValue<number | null>(null);
  const released = useSharedValue(false);
  const reach: StepReach = {
    first: Math.max(current - 1, 0),
    last: Math.min(current + 1, count - 1),
  };

  useEffect(() => {
    scheduleOnUI(() => {
      "worklet";
      if (goal.get() === current) return;
      goal.set(current);
      position.set(springStart(position.get(), current));
      position.set(withSpring(current, SPRING));
    });
  }, [current, goal, position]);

  const release = (velocity: number) => {
    "worklet";
    const target = settleTarget(position.get(), velocity, reach);

    released.set(true);
    goal.set(target);
    position.set(withSpring(target, { ...SPRING, velocity }));
    if (target !== current) scheduleOnRN(onStepChange, target);
  };

  const pan = usePanGesture({
    enabled: !still,
    activeOffsetY: [-10, 10],
    failOffsetX: [-20, 20],
    onBegin: (event) => {
      "worklet";
      cancelAnimation(position);
      dragStart.set(position.get());
      released.set(false);
      const onStep = event.y > PEEK_SLOT && event.y < height.get() - PEEK_SLOT;

      pagingFrom.set(onStep ? null : 0);
    },
    onUpdate: (event) => {
      "worklet";
      let from = pagingFrom.get();

      if (from === null) {
        const atEdge =
          event.translationY < 0 ? scrollAt.get() >= scrollMax.get() - 1 : scrollAt.get() <= 1;

        if (!atEdge) return;
        from = event.translationY;
        pagingFrom.set(from);
      }
      const next = dragStart.get() - (event.translationY - from) / DRAG_DISTANCE;

      position.set(Math.min(reach.last, Math.max(reach.first, next)));
    },
    onDeactivate: (event) => {
      "worklet";
      release(pagingFrom.get() === null ? 0 : -event.velocityY / DRAG_DISTANCE);
    },
    // A touch that never dragged (a tap mid-flight) still lands the column on a step.
    onFinalize: () => {
      "worklet";
      if (!released.get()) release(0);
    },
  });

  return { position, height, scrollAt, scrollMax, pan };
}
