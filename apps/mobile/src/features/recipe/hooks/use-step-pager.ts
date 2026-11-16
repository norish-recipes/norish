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
 * When `still` (Reduce Motion) the column holds and a release only decides the step.
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
  // Where the drag has taken the column; `position` follows it unless `still`.
  const dragged = useSharedValue(0);
  // The translation the drag started paging at; null while the step's text still scrolls.
  const pagingFrom = useSharedValue<number | null>(null);
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

  // Claims the touch only once it drags, so a tap (a peek's press) never stops a spring.
  const pan = usePanGesture({
    activeOffsetY: [-10, 10],
    failOffsetX: [-20, 20],
    onActivate: (event) => {
      "worklet";
      cancelAnimation(position);
      dragStart.set(position.get());
      dragged.set(position.get());
      const y = event.y - event.translationY;
      const onStep = y > PEEK_SLOT && y < height.get() - PEEK_SLOT;

      pagingFrom.set(onStep ? null : event.translationY);
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

      dragged.set(Math.min(reach.last, Math.max(reach.first, next)));
      if (!still) position.set(dragged.get());
    },
    onDeactivate: (event) => {
      "worklet";
      const velocity = pagingFrom.get() === null ? 0 : -event.velocityY / DRAG_DISTANCE;
      const target = settleTarget(dragged.get(), velocity, reach);

      if (target !== current) scheduleOnRN(onStepChange, target);
      if (still) return;
      goal.set(target);
      position.set(withSpring(target, { ...SPRING, velocity }));
    },
  });

  return { position, height, scrollAt, scrollMax, pan };
}
