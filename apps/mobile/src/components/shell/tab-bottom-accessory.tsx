import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

// ---------------------------------------------------------------------------
// Tab-aware bottom accessory content
//
// NativeTabs renders two instances simultaneously (inline + regular) but
// only one is visible at a time. onPressRecipe / onPressGrocery are passed
// in so state lives outside.
//
// NativeTabs identifies BottomAccessory by scanning its direct children for
// the specific component type. Because of this, `NativeTabs.BottomAccessory`
// must be rendered inline in the layout — only the inner content is extracted
// here.
// ---------------------------------------------------------------------------

export type AccessoryMode = "recipe" | "grocery";

type TabAccessoryContentProps = {
  mode: AccessoryMode;
  onPressRecipe: () => void;
  onPressGrocery: () => void;
};

export function TabAccessoryContent({
  mode,
  onPressRecipe,
  onPressGrocery,
}: TabAccessoryContentProps) {
  const intl = useIntl();
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const [foregroundColor] = useThemeColor(["foreground"] as const);
  const isInline = placement === "inline";

  const isRecipe = mode === "recipe";
  const label = isRecipe
    ? intl.formatMessage({ id: "recipes.dashboard.addRecipe" })
    : intl.formatMessage({ id: "groceries.page.addItem" });
  const icon: React.ComponentProps<typeof Ionicons>["name"] = isRecipe
    ? "add-circle"
    : "cart-outline";
  const onPress = isRecipe ? onPressRecipe : onPressGrocery;

  return (
    <View style={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name={icon} size={isInline ? 20 : 24} color={foregroundColor} />
        <Text style={{ color: foregroundColor, fontSize: isInline ? 15 : 17, fontWeight: "600" }}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
