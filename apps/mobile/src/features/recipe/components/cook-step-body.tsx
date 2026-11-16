import React from "react";
import { Text, View } from "react-native";
import { useIntl } from "react-intl";

import type { ResolvedCookingModeStep } from "@norish/shared-react/recipes";
import { useLoadedPageRecipe, usePageIngredients } from "@norish/shared-react/recipes";

import { plainText } from "../utils/recipe-rows";
import { StepChips, StepPhotos, StepText } from "./steps-section";

const STEP_TEXT = "text-foreground text-[28px] leading-[44px] font-medium tracking-[-0.3px]";

/** A cook mode step at full size: heading, text, chips and photos. */
export function StepBody({ step }: { step: ResolvedCookingModeStep }) {
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

/** A step as its peek: two lines of text and its chips. */
export function PeekBody({ step }: { step: ResolvedCookingModeStep }) {
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
