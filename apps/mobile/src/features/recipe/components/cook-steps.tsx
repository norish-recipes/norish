import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useIntl } from "react-intl";

import type { ResolvedCookingModeStep } from "@norish/shared-react/recipes";
import { useLoadedPageRecipe, usePageIngredients } from "@norish/shared-react/recipes";

import { plainText } from "../utils/recipe-rows";
import { StepChips, StepPhotos, StepText } from "./steps-section";

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
  const recipe = useLoadedPageRecipe();
  const lines = usePageIngredients();

  if (!step) return null;

  return (
    <Pressable
      accessibilityLabel={intl.formatMessage(
        { id: "recipes.cookMode.stepLabel" },
        { number: step.stepNumber }
      )}
      accessibilityRole="button"
      className="gap-3 py-3 opacity-[0.22]"
      testID={`cook-peek-${edge}`}
      onPress={onPress}
    >
      <Text className="text-foreground text-2xl leading-[33px] font-medium" numberOfLines={2}>
        {plainText(step.text)}
      </Text>
      <StepChips large lines={lines} step={step} systemUsed={recipe.systemUsed ?? "metric"} />
    </Pressable>
  );
}

/** Cook mode's steps: the current one large in the middle, the steps either side faded. */
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
  const step = steps[current];

  if (!step) return null;

  return (
    <View className="flex-1 px-5">
      <Peek edge="top" step={steps[current - 1]} onPress={() => onStepChange(current - 1)} />
      <Animated.View
        key={current}
        className="shrink"
        entering={FadeIn.duration(220)}
        testID="cook-step"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-5 py-2">
            {step.heading ? (
              <Text className="text-accent-text text-[15px] font-semibold">{step.heading}</Text>
            ) : null}
            <Text className="text-foreground text-[28px] leading-[44px] font-medium tracking-[-0.3px]">
              <StepText size="cook" stepIndex={step.stepNumber - 1} text={step.text} />
            </Text>
            <StepChips large lines={lines} step={step} systemUsed={recipe.systemUsed ?? "metric"} />
            {step.images.length > 0 ? (
              <StepPhotos
                images={step.images}
                label={intl.formatMessage({ id: "recipes.detail.stepPhoto" })}
              />
            ) : null}
          </View>
        </ScrollView>
      </Animated.View>
      <Peek edge="bottom" step={steps[current + 1]} onPress={() => onStepChange(current + 1)} />
    </View>
  );
}
