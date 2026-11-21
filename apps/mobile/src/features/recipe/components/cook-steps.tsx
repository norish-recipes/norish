import React from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";

import type { ResolvedCookingModeStep } from "@norish/shared-react/recipes";

import { useStepPager } from "../hooks/use-step-pager";
import { StepSlot } from "./cook-step-slot";

// Layout animations snap under Reduce Motion unless they opt out, so its crossfade does.
export const CROSSFADE_IN = FadeIn.duration(200).reduceMotion(ReduceMotion.Never);
export const CROSSFADE_OUT = FadeOut.duration(200).reduceMotion(ReduceMotion.Never);

// Steps either side kept mounted, so one paging into a peek is already laid out.
const WINDOW = 2;

/** The step column: the slots within `WINDOW` of the current step, under the pager's pan. */
function StepColumn({
  steps,
  current,
  reduceMotion,
  onStepChange,
}: {
  steps: ResolvedCookingModeStep[];
  current: number;
  reduceMotion: boolean;
  onStepChange: (step: number) => void;
}) {
  const pager = useStepPager({ count: steps.length, current, reduceMotion, onStepChange });
  const first = Math.max(current - WINDOW, 0);

  return (
    <GestureDetector gesture={pager.pan}>
      <View
        className="mx-5 flex-1"
        onLayout={(event) => pager.height.set(event.nativeEvent.layout.height)}
      >
        {steps.slice(first, current + WINDOW + 1).map((step, offset) => {
          const index = first + offset;

          return (
            <StepSlot
              key={step.stepNumber}
              current={current}
              index={index}
              pager={pager}
              step={step}
              onPeekPress={() => onStepChange(index)}
            />
          );
        })}
      </View>
    </GestureDetector>
  );
}

/** The current step large in the middle, its neighbours faded. Under Reduce Motion the column
 * holds and a step change crossfades; the view switch's own fade skips that one. */
export function CookSteps({
  steps,
  current,
  onStepChange,
}: {
  steps: ResolvedCookingModeStep[];
  current: number;
  onStepChange: (step: number) => void;
}) {
  const reduceMotion = useReducedMotion();

  if (!steps[current]) return null;
  if (!reduceMotion) {
    return (
      <StepColumn
        current={current}
        reduceMotion={false}
        steps={steps}
        onStepChange={onStepChange}
      />
    );
  }

  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      <Animated.View
        key={current}
        className="flex-1"
        entering={CROSSFADE_IN}
        exiting={CROSSFADE_OUT}
      >
        <StepColumn reduceMotion current={current} steps={steps} onStepChange={onStepChange} />
      </Animated.View>
    </LayoutAnimationConfig>
  );
}
