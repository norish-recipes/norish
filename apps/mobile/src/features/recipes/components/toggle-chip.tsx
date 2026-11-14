import type { ComponentProps } from "react";
import React from "react";
import { Pressable, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

/** A filter choice in the Filters sheet: a pill that is filled while it applies. */
export function ToggleChip({
  label,
  icon,
  active,
  onPress,
  testID,
}: {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const [foreground, accentForeground] = useThemeColor([
    "foreground",
    "accent-foreground",
  ] as const);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`h-[34px] flex-none flex-row items-center gap-1.5 rounded-full px-[13px] ${active ? "bg-accent" : "bg-default"}`}
      testID={testID}
      onPress={onPress}
    >
      {icon ? (
        <Ionicons color={active ? accentForeground : foreground} name={icon} size={14} />
      ) : null}
      <Text
        className={`text-sm font-medium ${active ? "text-accent-foreground" : "text-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
