import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useThemeColor } from 'heroui-native';
import React, { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useIntl } from 'react-intl';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { DummyStep } from '../dummy-data';
import { SmartText } from '../text-renderer';

const SWIPE_V_THRESHOLD = 40;
const SWIPE_H_THRESHOLD = 50;
const SPRING = { damping: 22, stiffness: 250, mass: 0.7 } as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

type CookModeStepsProps = {
  steps: DummyStep[];
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
  images?: DummyStep['images'];
};

function resolveSteps(steps: DummyStep[]): ResolvedStep[] {
  const resolved: ResolvedStep[] = [];
  let currentHeading: string | undefined;
  let stepNumber = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (step.text.trim().startsWith('#')) {
      currentHeading = step.text.trim().replace(/^#+\s*/, '');
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
  const [foregroundColor, mutedColor, accentColor, accentForegroundColor] =
    useThemeColor([
      'foreground',
      'muted',
      'accent',
      'accent-foreground',
    ] as const);

  const resolvedSteps = useMemo(() => resolveSteps(steps), [steps]);
  const totalSteps = resolvedSteps.length;
  const step = resolvedSteps[currentStep];

  // ── Reanimated shared values ──────────────────────────────────────────────
  const translateY = useSharedValue(0);
  const contentOpacity = useSharedValue(1);

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

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;
  const totalStepsRef = useRef(totalSteps);
  totalStepsRef.current = totalSteps;

  // ── Pan gesture ───────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .activeOffsetX([-20, 20])
    .onUpdate((e) => {
      translateY.value = e.translationY * 0.3;
      contentOpacity.value = 1 - Math.min(Math.abs(e.translationY) / 300, 0.5);
    })
    .onEnd((e) => {
      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);

      if (absX > absY && e.translationX < -SWIPE_H_THRESHOLD) {
        runOnJS(triggerSwipeLeft)();
      } else if (absY > absX) {
        if (e.translationY < -SWIPE_V_THRESHOLD) {
          runOnJS(goToNext)();
        } else if (e.translationY > SWIPE_V_THRESHOLD) {
          runOnJS(goToPrev)();
        }
      }
      translateY.value = withSpring(0, SPRING);
      contentOpacity.value = withTiming(1, { duration: 150 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: contentOpacity.value,
  }));

  if (!step) return null;

  return (
    <View className="flex-1">
      {/* Step content with gesture detector */}
      <GestureDetector gesture={panGesture}>
        <Animated.View className="flex-1 justify-center" style={animatedStyle}>
          <View className="px-7 py-10 gap-4 items-start">
            {/* Section heading badge */}
            {step.heading && (
              <View
                className="px-3.5 py-1.5 rounded-full"
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
              className="size-12 rounded-full items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              <Text
                className="text-[22px] font-extrabold"
                style={{ color: accentForegroundColor }}
              >
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
                <Ionicons
                  name="swap-vertical"
                  size={14}
                  color={`${mutedColor}80`}
                />
                <Text
                  className="text-xs"
                  style={{ color: `${mutedColor}80` }}
                >
                  {intl.formatMessage({ id: 'recipes.cookMode.swipeSteps' })}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Ionicons
                  name="arrow-back"
                  size={14}
                  color={`${mutedColor}80`}
                />
                <Text
                  className="text-xs"
                  style={{ color: `${mutedColor}80` }}
                >
                  {intl.formatMessage({
                    id: 'recipes.cookMode.swipeIngredients',
                  })}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Navigation footer */}
      <View
        className="flex-row items-center justify-between px-6 py-4 gap-4"
        style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${mutedColor}15` }}
      >
        {/* Previous */}
        <Pressable
          onPress={goToPrev}
          disabled={currentStep === 0}
          style={[
            { backgroundColor: `${mutedColor}15` },
            currentStep === 0 && { opacity: 0.3 },
          ]}
          className="size-12 rounded-full items-center justify-center"
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
              {' '}/ {totalSteps}
            </Text>
          </Text>
          <View className="flex-row gap-1.5 items-center justify-center flex-wrap">
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
                    backgroundColor:
                      i === currentStep ? accentColor : `${mutedColor}30`,
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
          className="size-12 rounded-full items-center justify-center"
        >
          <Ionicons
            name="chevron-down"
            size={22}
            color={
              currentStep === totalSteps - 1
                ? `${mutedColor}40`
                : foregroundColor
            }
          />
        </Pressable>
      </View>
    </View>
  );
}

// Only keep styles that can't be expressed with Tailwind
const styles = StyleSheet.create({
  stepText: {
    fontSize: 22,
    lineHeight: 34,
    letterSpacing: -0.2,
  },
});
