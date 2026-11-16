import type { PanGesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import { useEffect } from "react";
import { usePanGesture } from "react-native-gesture-handler";
import { cancelAnimation, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import {
  clampToReach,
  DRAG_DISTANCE,
  onStep,
  settleTarget,
  SPRING,
  springStart,
  stepReach,
} from "../utils/cook-pager";

/** What the pan reads and writes, shared by the column's slots. */
export type StepPager = {
  position: SharedValue<number>;
  height: SharedValue<number>;
  scrollAt: SharedValue<number>;
  scrollMax: SharedValue<number>;
  pan: PanGesture;
};

/** The column's `position`, fractional mid-page: a drag moves it, a release or step change springs
 * it. Under `reduceMotion` it holds and a release only decides the step. */
export function useStepPager({
  count,
  current,
  reduceMotion,
  onStepChange,
}: {
  count: number;
  current: number;
  reduceMotion: boolean;
  onStepChange: (step: number) => void;
}): StepPager {
  const position = useSharedValue(current);
  // The step the last spring ran to, so a release's own step change doesn't restart it.
  const goal = useSharedValue(current);
  const height = useSharedValue(0);
  const scrollAt = useSharedValue(0);
  const scrollMax = useSharedValue(0);
  const dragStart = useSharedValue(0);
  // Where the drag has taken the column; `position` follows it unless `reduceMotion`.
  const dragged = useSharedValue(0);
  // The translation the drag started paging at; null while the step's text still scrolls.
  const pagingFrom = useSharedValue<number | null>(null);
  const reach = stepReach(current, count);

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
      const startY = event.y - event.translationY;

      pagingFrom.set(onStep(startY, height.get()) ? null : event.translationY);
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

      dragged.set(clampToReach(next, reach));
      if (!reduceMotion) position.set(dragged.get());
    },
    onDeactivate: (event) => {
      "worklet";
      const velocity = pagingFrom.get() === null ? 0 : -event.velocityY / DRAG_DISTANCE;
      const target = settleTarget(dragged.get(), velocity, reach);

      if (target !== current) scheduleOnRN(onStepChange, target);
      if (reduceMotion) return;
      goal.set(target);
      position.set(withSpring(target, { ...SPRING, velocity }));
    },
  });

  return { position, height, scrollAt, scrollMax, pan };
}
