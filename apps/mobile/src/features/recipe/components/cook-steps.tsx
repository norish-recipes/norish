import type { PanGesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import {
  GestureDetector,
  Pressable,
  useNativeGesture,
  usePanGesture,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useScrollOffset,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { useIntl } from "react-intl";

import type { ResolvedCookingModeStep } from "@norish/shared-react/recipes";
import { useLoadedPageRecipe, usePageIngredients } from "@norish/shared-react/recipes";

import type { StepReach } from "../utils/cook-pager";
import { DRAG_DISTANCE, PEEK_SLOT, settleTarget, slotPose, springStart } from "../utils/cook-pager";
import { plainText } from "../utils/recipe-rows";
import { StepChips, StepPhotos, StepText } from "./steps-section";

// Layout animations snap under Reduce Motion unless they opt out, so its crossfade does.
export const CROSSFADE_IN = FadeIn.duration(200).reduceMotion(ReduceMotion.Never);
export const CROSSFADE_OUT = FadeOut.duration(200).reduceMotion(ReduceMotion.Never);

// Critically damped: a release lands on its step without overshooting into the next.
const SPRING = { damping: 30, stiffness: 260, mass: 1 };
// Steps either side kept mounted, so one paging into a peek is already laid out.
const WINDOW = 2;
const STEP_TEXT = "text-foreground text-[28px] leading-[44px] font-medium tracking-[-0.3px]";

/** What the pan reads and writes, shared by the column's slots. */
type Column = {
  position: SharedValue<number>;
  height: SharedValue<number>;
  scrollAt: SharedValue<number>;
  scrollMax: SharedValue<number>;
  pan: PanGesture;
};

function StepBody({ step }: { step: ResolvedCookingModeStep }) {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const lines = usePageIngredients();

  return (
    <View className="gap-5 py-2">
      {step.heading ? (
        <Text className="text-accent-text text-[15px] font-semibold">{step.heading}</Text>
      ) : null}
      <StepText
        className={STEP_TEXT}
        size="cook"
        stepIndex={step.stepNumber - 1}
        text={step.text}
      />
      <StepChips large lines={lines} step={step} systemUsed={recipe.systemUsed ?? "metric"} />
      {step.images.length > 0 ? (
        <StepPhotos
          images={step.images}
          label={intl.formatMessage({ id: "recipes.detail.stepPhoto" })}
        />
      ) : null}
    </View>
  );
}

function PeekBody({ step }: { step: ResolvedCookingModeStep }) {
  const recipe = useLoadedPageRecipe();
  const lines = usePageIngredients();

  return (
    <View className="gap-3 py-3">
      <Text className={STEP_TEXT} numberOfLines={2}>
        {plainText(step.text)}
      </Text>
      <StepChips large lines={lines} step={step} systemUsed={recipe.systemUsed ?? "metric"} />
    </View>
  );
}

/**
 * One step, posed by its distance from the column's position: full in the middle region, or as
 * its peek. Keyed by step, so a step change moves no slot.
 */
function StepSlot({
  step,
  index,
  side,
  column,
  onPeekPress,
}: {
  step: ResolvedCookingModeStep;
  index: number;
  side: number;
  column: Column;
  onPeekPress: () => void;
}) {
  const intl = useIntl();
  const isCurrent = side === 0;
  const isPeek = Math.abs(side) === 1;
  const peekHeight = useSharedValue(0);
  const viewport = useSharedValue(0);
  const content = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollAt = useScrollOffset(scrollRef);
  // The step's scroll and the column's pan run together; the pan pages only from a scroll edge.
  const scroll = useNativeGesture({ simultaneousWith: column.pan });
  const pose = useDerivedValue(() =>
    slotPose(index - column.position.get(), column.height.get(), peekHeight.get())
  );
  const fullStyle = useAnimatedStyle(() => {
    const { y, scale, fullOpacity } = pose.get();

    return { opacity: fullOpacity, transform: [{ translateY: y }, { scale }] };
  });
  const peekStyle = useAnimatedStyle(() => {
    const { y, scale, peekOpacity } = pose.get();
    const centred = (column.height.get() - peekHeight.get()) / 2;

    return { opacity: peekOpacity, transform: [{ translateY: centred + y }, { scale }] };
  });

  useAnimatedReaction(
    () => (isCurrent ? [scrollAt.get(), Math.max(0, content.get() - viewport.get())] : null),
    (edge) => {
      if (!edge) return;
      column.scrollAt.set(edge[0] ?? 0);
      column.scrollMax.set(edge[1] ?? 0);
    },
    [isCurrent]
  );

  return (
    <View className="absolute inset-0" style={{ pointerEvents: "box-none" }}>
      <View
        className="absolute inset-x-0 overflow-hidden"
        style={{
          top: PEEK_SLOT,
          bottom: PEEK_SLOT,
          pointerEvents: isCurrent ? "box-none" : "none",
        }}
      >
        <Animated.View
          accessibilityElementsHidden={!isCurrent}
          className="flex-1"
          importantForAccessibility={isCurrent ? "auto" : "no-hide-descendants"}
          style={[{ transformOrigin: "left center" }, fullStyle]}
          testID={isCurrent ? "cook-step" : undefined}
        >
          <GestureDetector gesture={scroll}>
            <Animated.ScrollView
              ref={scrollRef}
              bounces={false}
              contentContainerClassName="grow justify-center"
              scrollEnabled={isCurrent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={(_, height) => content.set(height)}
              onLayout={(event) => viewport.set(event.nativeEvent.layout.height)}
            >
              <StepBody step={step} />
            </Animated.ScrollView>
          </GestureDetector>
        </Animated.View>
      </View>
      <Animated.View
        accessibilityElementsHidden={!isPeek}
        className="absolute inset-x-0 top-0"
        importantForAccessibility={isPeek ? "auto" : "no-hide-descendants"}
        style={[
          { transformOrigin: "left center", pointerEvents: isPeek ? "auto" : "none" },
          peekStyle,
        ]}
        onLayout={(event) => peekHeight.set(event.nativeEvent.layout.height)}
      >
        {/* Gesture handler's Pressable hit-tests natively; RN's checks a layout without the pose. */}
        <Pressable
          accessibilityLabel={intl.formatMessage(
            { id: "recipes.cookMode.stepLabel" },
            { number: step.stepNumber }
          )}
          accessibilityRole="button"
          testID={isPeek ? `cook-peek-${side < 0 ? "top" : "bottom"}` : undefined}
          onPress={onPeekPress}
        >
          <PeekBody step={step} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * The step column: `position` is the step it shows, fractional mid-page. A drag moves it, a
 * release springs it with the finger's velocity; a step change from anywhere else springs too.
 */
function StepColumn({
  steps,
  current,
  still,
  onStepChange,
}: {
  steps: ResolvedCookingModeStep[];
  current: number;
  still: boolean;
  onStepChange: (step: number) => void;
}) {
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
    last: Math.min(current + 1, steps.length - 1),
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
  const column: Column = { position, height, scrollAt, scrollMax, pan };
  const first = Math.max(current - WINDOW, 0);

  return (
    <GestureDetector gesture={pan}>
      <View
        className="mx-5 flex-1"
        onLayout={(event) => height.set(event.nativeEvent.layout.height)}
      >
        {steps.slice(first, current + WINDOW + 1).map((step, offset) => (
          <StepSlot
            key={step.stepNumber}
            column={column}
            index={first + offset}
            side={first + offset - current}
            step={step}
            onPeekPress={() => onStepChange(first + offset)}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

/**
 * Cook mode's steps: the current one large in the middle, the steps either side faded. Under
 * Reduce Motion the column doesn't move; each step change crossfades a new one in.
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
  const reduceMotion = useReducedMotion();

  if (!steps[current]) return null;
  if (!reduceMotion) {
    return <StepColumn current={current} steps={steps} still={false} onStepChange={onStepChange} />;
  }

  return (
    <Animated.View key={current} className="flex-1" entering={CROSSFADE_IN} exiting={CROSSFADE_OUT}>
      <StepColumn still current={current} steps={steps} onStepChange={onStepChange} />
    </Animated.View>
  );
}
