import type { ComponentProps } from "react";
import React from "react";
import { Text } from "react-native";
import { useGroupedFill } from "@/components/on-sheet";
import { PressableScale } from "@/components/pressable-scale";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

/** A choice, such as a filter or a Category: a pill that is filled while it applies. */
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
  const fill = useGroupedFill();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`h-[34px] flex-none flex-row items-center gap-1.5 rounded-full px-[13px] ${active ? "bg-accent" : fill}`}
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
    </PressableScale>
  );
}
