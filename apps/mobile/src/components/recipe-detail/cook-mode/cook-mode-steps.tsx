import type { MappedStep } from "@/lib/recipes/map-recipe-to-steps";
import React, { useCallback, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  SlideOutUp,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { SmartText } from "../text-renderer";

const SLIDE_DISTANCE = 40;
const ANIM_DURATION = 250;

const SWIPE_V_THRESHOLD = 40;
const SWIPE_H_THRESHOLD = 50;

// ─── Types ─────────────────────────────────────────────────────────────────────

type CookModeStepsProps = {
  steps: MappedStep[];
  recipeId: string;
  recipeName?: string;
  currentStep: number;
  onStepChange: (step: number) => void;
  onSwipeLeft?: () => void;
};

type ResolvedStep = {
  originalIndex: number;
  stepNumber: number;
  text: string;
  heading?: string;
  images?: MappedStep["images"];
};

function resolveSteps(steps: MappedStep[]): ResolvedStep[] {
  const resolved: ResolvedStep[] = [];
  let currentHeading: string | undefined;
  let stepNumber = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (step.text.trim().startsWith("#")) {
      currentHeading = step.text.trim().replace(/^#+\s*/, "");
      continue;
    }
    stepNumber++;
    resolved.push({
      originalIndex: i,
      stepNumber,
      text: step.text,
      heading: currentHeading,
      images: step.images,
    });
  }
  return resolved;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CookModeSteps({
  steps,
  recipeId,
  recipeName,
  currentStep,
  onStepChange,
  onSwipeLeft,
}: CookModeStepsProps) {
  const intl = useIntl();
  const [foregroundColor, mutedColor, accentColor, accentForegroundColor] = useThemeColor([
    "foreground",
    "muted",
    "accent",
    "accent-foreground",
  ] as const);

  const resolvedSteps = useMemo(() => resolveSteps(steps), [steps]);
  const totalSteps = resolvedSteps.length;
  const step = resolvedSteps[currentStep];

  // Track direction: 1 = forward (next), -1 = backward (prev)
  const prevStepRef = useRef(currentStep);
  const direction = currentStep >= prevStepRef.current ? 1 : -1;
  // Update ref after computing direction
  if (prevStepRef.current !== currentStep) {
    prevStepRef.current = currentStep;
  }

  // Directional entering/exiting animations
  const entering =
    direction === 1
      ? SlideInDown.duration(ANIM_DURATION).withInitialValues({
          transform: [{ translateY: SLIDE_DISTANCE }],
        })
      : SlideInUp.duration(ANIM_DURATION).withInitialValues({
          transform: [{ translateY: -SLIDE_DISTANCE }],
        });

  const exiting =
    direction === 1 ? SlideOutUp.duration(ANIM_DURATION) : SlideOutDown.duration(ANIM_DURATION);

  const goToNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onStepChange(currentStep + 1);
    }
  }, [currentStep, totalSteps, onStepChange]);

  const goToPrev = useCallback(() => {
    if (currentStep > 0) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onStepChange(currentStep - 1);
    }
  }, [currentStep, onStepChange]);

  const triggerSwipeLeft = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSwipeLeft?.();
  }, [onSwipeLeft]);

  // ── Pan gesture ───────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);

      if (absX > absY && e.translationX < -SWIPE_H_THRESHOLD) {
        scheduleOnRN(triggerSwipeLeft);
      } else if (absY > absX) {
        if (e.translationY < -SWIPE_V_THRESHOLD) {
          scheduleOnRN(goToNext);
        } else if (e.translationY > SWIPE_V_THRESHOLD) {
          scheduleOnRN(goToPrev);
        }
      }
    });

  if (!step) return null;

  return (
    <View className="flex-1" style={{ overflow: "hidden" }}>
      {/* Step content with gesture detector */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          key={`step-${currentStep}`}
          entering={entering}
          exiting={exiting}
          className="flex-1 justify-center"
        >
          <View className="items-start gap-4 px-7 py-10">
            {/* Section heading badge */}
            {step.heading && (
              <View
                className="rounded-full px-3.5 py-1.5"
                style={{ backgroundColor: `${accentColor}18` }}
              >
                <Text
                  className="text-[13px] font-semibold uppercase"
                  style={{ color: accentColor, letterSpacing: 0.5 }}
                >
                  {step.heading}
                </Text>
              </View>
            )}

            {/* Step number */}
            <View
              className="size-12 items-center justify-center rounded-full"
              style={{ backgroundColor: accentColor }}
            >
              <Text className="text-[22px] font-extrabold" style={{ color: accentForegroundColor }}>
                {step.stepNumber}
              </Text>
            </View>

            {/* Step text with SmartText */}
            <SmartText
              style={[styles.stepText, { color: foregroundColor }]}
              highlightTimers
              timerContext={{
                recipeId,
                recipeName,
                stepIndex: step.originalIndex,
              }}
            >
              {step.text}
            </SmartText>

            {/* Swipe hints */}
            <View className="mt-6 gap-1.5 opacity-80">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="swap-vertical" size={14} color={`${mutedColor}80`} />
                <Text className="text-xs" style={{ color: `${mutedColor}80` }}>
                  {intl.formatMessage({ id: "recipes.cookMode.swipeSteps" })}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="arrow-back" size={14} color={`${mutedColor}80`} />
                <Text className="text-xs" style={{ color: `${mutedColor}80` }}>
                  {intl.formatMessage({
                    id: "recipes.cookMode.swipeIngredients",
                  })}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Navigation footer */}
      <View
        className="flex-row items-center justify-between gap-4 px-6 py-4"
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: `${mutedColor}15`,
        }}
      >
        {/* Previous */}
        <Pressable
          onPress={goToPrev}
          disabled={currentStep === 0}
          style={[{ backgroundColor: `${mutedColor}15` }, currentStep === 0 && { opacity: 0.3 }]}
          className="size-12 items-center justify-center rounded-full"
        >
          <Ionicons
            name="chevron-up"
            size={22}
            color={currentStep === 0 ? `${mutedColor}40` : foregroundColor}
          />
        </Pressable>

        {/* Progress */}
        <View className="flex-1 items-center gap-2.5">
          <Text style={{ color: foregroundColor }}>
            <Text className="text-lg font-bold">{currentStep + 1}</Text>
            <Text className="text-sm" style={{ color: mutedColor }}>
              {" "}
              / {totalSteps}
            </Text>
          </Text>
          <View className="flex-row flex-wrap items-center justify-center gap-1.5">
            {resolvedSteps.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onStepChange(i);
                }}
                hitSlop={4}
              >
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === currentStep ? accentColor : `${mutedColor}30`,
                    width: i === currentStep ? 20 : 6,
                  }}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Next */}
        <Pressable
          onPress={goToNext}
          disabled={currentStep === totalSteps - 1}
          style={[
            { backgroundColor: `${mutedColor}15` },
            currentStep === totalSteps - 1 && { opacity: 0.3 },
          ]}
          className="size-12 items-center justify-center rounded-full"
        >
          <Ionicons
            name="chevron-down"
            size={22}
            color={currentStep === totalSteps - 1 ? `${mutedColor}40` : foregroundColor}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepText: {
    fontSize: 22,
    lineHeight: 34,
    letterSpacing: -0.2,
  },
});
