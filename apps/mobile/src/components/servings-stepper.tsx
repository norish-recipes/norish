import React from "react";
import { View } from "react-native";
import { AnimatedNumber } from "@/components/animated-number";
import { Stepper } from "@/components/stepper";
import { useIntl } from "react-intl";

import { formatServings, servingsDown } from "@norish/shared-react/recipes";

/** The `Stepper` props that say what a servings stepper steps and whether it can. */
export function useServingsStepper(servings: number) {
  const intl = useIntl();

  return {
    canDecrement: servingsDown(servings) !== servings,
    decreaseLabel: intl.formatMessage({ id: "recipes.detail.decreaseServings" }),
    increaseLabel: intl.formatMessage({ id: "recipes.detail.increaseServings" }),
  };
}

/** A servings stepper over a plain count; its value's testID is `${testID}-value`. */
export function ServingsStepper({
  servings,
  testID,
  onDecrement,
  onIncrement,
}: {
  servings: number;
  testID: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const stepper = useServingsStepper(servings);

  return (
    <Stepper {...stepper} testID={testID} onDecrement={onDecrement} onIncrement={onIncrement}>
      <View className="min-w-8 items-center" testID={`${testID}-value`}>
        <AnimatedNumber
          className="text-foreground text-base font-semibold"
          value={formatServings(servings)}
        />
      </View>
    </Stepper>
  );
}
