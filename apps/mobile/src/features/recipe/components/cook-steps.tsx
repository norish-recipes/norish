import React, { useLayoutEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { useIntl } from "react-intl";

import type { ResolvedCookingModeStep } from "@norish/shared-react/recipes";
import { useLoadedPageRecipe, usePageIngredients } from "@norish/shared-react/recipes";

import { DRAG_DISTANCE, pagerPose, PEEK_SLOT, settleTarget } from "../utils/cook-pager";
import { plainText } from "../utils/recipe-rows";
import { StepChips, StepPhotos, StepText } from "./steps-section";

// Critically damped: a release lands on its step without overshooting into the next.
const SPRING = { damping: 30, stiffness: 260, mass: 1 };

/** A step beside the current one, faded; a tap moves to it. */
function Peek({
  step,
  edge,
  onPress,
}: {
  step: ResolvedCookingModeStep | undefined;
  edge: "top" | "bottom";
  onPress: () => void;
}) {
  const intl = useIntl();

  if (!step) return null;

  return (
    <Pressable
      accessibilityLabel={intl.formatMessage(
        { id: "recipes.cookMode.stepLabel" },
        { number: step.stepNumber }
      )}
      accessibilityRole="button"
      className={`h-full ${edge === "top" ? "justify-end" : "justify-start"} py-3`}
      testID={`cook-peek-${edge}`}
      onPress={onPress}
    >
      <Text
        className="text-foreground text-[28px] leading-[44px] font-medium tracking-[-0.3px]"
        numberOfLines={2}
      >
        {plainText(step.text)}
      </Text>
    </Pressable>
  );
}

/**
 * Cook mode's steps: the current one large in the middle, the steps either side faded.
 * A drag moves the column by `drag` steps; a release, a button or a peek tap springs it to a step.
 */
export function CookSteps({
  steps,
  current,
  onStepChange,
}: {
  steps: ResolvedCookingModeStep[];
  current: number;
  onStepChange: (step: number) => void;
}) {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const lines = usePageIngredients();
  const reduceMotion = useReducedMotion();
  const step = steps[current];
  const drag = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const region = useSharedValue(0);
  const previousStepRef = useRef(current);
  const min = current > 0 ? -1 : 0;
  const max = current < steps.length - 1 ? 1 : 0;

  // Any step change, a drag's own included, restarts from the pose the old layout was in.
  useLayoutEffect(() => {
    const delta = current - previousStepRef.current;

    previousStepRef.current = current;
    if (delta === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (reduceMotion) {
      drag.set(0);

      return;
    }
    drag.set(drag.get() - delta);
    drag.set(withSpring(0, SPRING));
  }, [current, drag, reduceMotion]);

  const pan = usePanGesture({
    enabled: !reduceMotion,
    activeOffsetY: [-10, 10],
    failOffsetX: [-20, 20],
    onBegin: () => {
      "worklet";
      cancelAnimation(drag);
      dragStart.set(drag.get());
    },
    onUpdate: (event) => {
      "worklet";
      const next = dragStart.get() - event.translationY / DRAG_DISTANCE;

      drag.set(Math.min(max, Math.max(min, next)));
    },
    onDeactivate: (event) => {
      "worklet";
      const velocity = -event.velocityY / DRAG_DISTANCE;
      const target = settleTarget(drag.get(), velocity, min, max);

      drag.set(
        withSpring(target, { ...SPRING, velocity }, (finished) => {
          if (finished && target !== 0) scheduleOnRN(onStepChange, current + target);
        })
      );
    },
  });

  const topStyle = useAnimatedStyle(() => {
    const { y, scale, opacity } = pagerPose(drag.get(), region.get()).top;

    return { opacity, transform: [{ translateY: y }, { scale }], transformOrigin: "left bottom" };
  });
  const currentStyle = useAnimatedStyle(() => {
    const { y, scale, opacity } = pagerPose(drag.get(), region.get()).current;

    return { opacity, transform: [{ translateY: y }, { scale }], transformOrigin: "left top" };
  });
  const bottomStyle = useAnimatedStyle(() => {
    const { y, scale, opacity } = pagerPose(drag.get(), region.get()).bottom;

    return { opacity, transform: [{ translateY: y }, { scale }], transformOrigin: "left top" };
  });

  if (!step) return null;

  return (
    <GestureDetector gesture={pan}>
      <View className="flex-1 px-5">
        <Animated.View style={[{ height: PEEK_SLOT }, topStyle]}>
          <Peek edge="top" step={steps[current - 1]} onPress={() => onStepChange(current - 1)} />
        </Animated.View>
        <Animated.View
          // Reduce Motion has no pager, so a new step crossfades in instead.
          key={reduceMotion ? current : undefined}
          className="flex-1"
          entering={reduceMotion ? FadeIn.duration(220) : undefined}
          style={currentStyle}
          testID="cook-step"
          onLayout={(event) => region.set(event.nativeEvent.layout.height)}
        >
          <ScrollView
            contentContainerClassName="grow justify-center"
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-5 py-2">
              {step.heading ? (
                <Text className="text-accent-text text-[15px] font-semibold">{step.heading}</Text>
              ) : null}
              <StepText
                className="text-foreground text-[28px] leading-[44px] font-medium tracking-[-0.3px]"
                size="cook"
                stepIndex={step.stepNumber - 1}
                text={step.text}
              />
              <StepChips
                large
                lines={lines}
                step={step}
                systemUsed={recipe.systemUsed ?? "metric"}
              />
              {step.images.length > 0 ? (
                <StepPhotos
                  images={step.images}
                  label={intl.formatMessage({ id: "recipes.detail.stepPhoto" })}
                />
              ) : null}
            </View>
          </ScrollView>
        </Animated.View>
        <Animated.View style={[{ height: PEEK_SLOT }, bottomStyle]}>
          <Peek edge="bottom" step={steps[current + 1]} onPress={() => onStepChange(current + 1)} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
