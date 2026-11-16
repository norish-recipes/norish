import React from "react";
import { View } from "react-native";
import { AnimatedNumber } from "@/components/animated-number";
import { GlassStepper } from "@/components/glass-stepper";
import { useIntl } from "react-intl";

import { formatServings, servingsDown } from "@norish/shared-react/recipes";

/** Servings with a glass minus and plus either side of the number; `testID` prefixes the three. */
export function ServingsStepper({
  servings,
  onDecrement,
  onIncrement,
  testID,
}: {
  servings: number;
  onDecrement: () => void;
  onIncrement: () => void;
  testID: string;
}) {
  const intl = useIntl();

  return (
    <GlassStepper
      canDecrement={servingsDown(servings) !== servings}
      decreaseLabel={intl.formatMessage({ id: "recipes.detail.decreaseServings" })}
      increaseLabel={intl.formatMessage({ id: "recipes.detail.increaseServings" })}
      testID={testID}
      onDecrement={onDecrement}
      onIncrement={onIncrement}
    >
      <View className="min-w-8 items-center" testID={`${testID}-value`}>
        <AnimatedNumber
          className="text-foreground text-base font-semibold"
          value={formatServings(servings)}
        />
      </View>
    </GlassStepper>
  );
}
