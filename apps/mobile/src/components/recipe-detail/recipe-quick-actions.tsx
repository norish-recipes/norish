import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";
import { withUniwind } from "uniwind";

const StyledEntypo = withUniwind(Entypo);

/**
 * Cook, Plan and Grocery action buttons — styled after the HeroUI Native
 * cooking-onboarding example.
 *
 * - Cook: prominent pill with accent background
 * - Plan: secondary pill with accent-colored icon
 * - Groceries: icon-only square button
 */
export function RecipeQuickActions({ onCook }: { onCook?: () => void }) {
  const intl = useIntl();
  const [foregroundColor, accentColor, accentForegroundColor] = useThemeColor([
    "foreground",
    "accent",
    "accent-foreground",
  ] as const);

  return (
    <View style={styles.container}>
      {/* Cook — primary pill */}
      <Button
        feedbackVariant="scale"
        className="bg-accent h-12 flex-row items-center gap-1 rounded-[14px] px-4"
        onPress={onCook}
      >
        <AntDesign name="fire" size={16} color={accentForegroundColor} />
        <Text style={[styles.pillLabel, { color: accentForegroundColor }]}>
          {intl.formatMessage({ id: "recipes.detail.cook" })}
        </Text>
      </Button>

      {/* Plan — secondary pill */}
      <Button
        variant="secondary"
        feedbackVariant="scale"
        className="bg-surface-tertiary h-12 flex-row items-center gap-1 rounded-[14px] px-4"
        onPress={() => Alert.alert("Plan", "Meal planning coming soon!")}
      >
        <StyledEntypo name="plus" size={16} className="text-accent" />
        <Text style={[styles.pillLabel, { color: foregroundColor }]}>
          {intl.formatMessage({ id: "recipes.actions.plan" })}
        </Text>
      </Button>

      {/* Groceries — icon-only square */}
      <Button
        variant="secondary"
        feedbackVariant="scale"
        className="bg-surface-tertiary size-12 items-center justify-center rounded-[14px]"
        isIconOnly
        onPress={() => Alert.alert("Groceries", "Ingredients added to your grocery list.")}
      >
        <Ionicons name="cart-outline" size={18} color={foregroundColor} />
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  pillLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});
