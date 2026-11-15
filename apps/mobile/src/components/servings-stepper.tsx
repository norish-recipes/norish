import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { formatServings } from "@norish/shared-react/recipes";

/** Servings with a round minus and plus either side of the number; `testID` prefixes the three. */
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
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <View className="flex-row items-center gap-1.5">
      <Button
        isIconOnly
        accessibilityLabel={intl.formatMessage({ id: "recipes.detail.decreaseServings" })}
        className="bg-default size-[34px] rounded-full"
        testID={`${testID}-decrease`}
        variant="secondary"
        onPress={onDecrement}
      >
        <Ionicons color={foreground} name="remove" size={17} />
      </Button>
      <Text
        className="text-foreground min-w-[26px] text-center text-base font-semibold"
        testID={`${testID}-value`}
      >
        {formatServings(servings)}
      </Text>
      <Button
        isIconOnly
        accessibilityLabel={intl.formatMessage({ id: "recipes.detail.increaseServings" })}
        className="bg-default size-[34px] rounded-full"
        testID={`${testID}-increase`}
        variant="secondary"
        onPress={onIncrement}
      >
        <Ionicons color={foreground} name="add" size={17} />
      </Button>
    </View>
  );
}
