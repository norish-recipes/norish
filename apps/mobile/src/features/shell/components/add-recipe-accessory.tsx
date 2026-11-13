import React from "react";
import { Pressable, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** The Add recipe label the tab bar's bottom accessory draws; the Add recipe sheet opens from it later. */
export function AddRecipeAccessory() {
  const intl = useIntl();
  const [accent] = useThemeColor(["accent"] as const);

  return (
    <Pressable
      accessibilityRole="button"
      className="h-full flex-row items-center justify-center gap-2"
      testID="add-recipe"
    >
      <Ionicons color={accent} name="add-circle-outline" size={22} />
      <Text className="text-foreground text-base font-semibold">
        {intl.formatMessage({ id: "recipes.dashboard.addRecipe" })}
      </Text>
    </Pressable>
  );
}
