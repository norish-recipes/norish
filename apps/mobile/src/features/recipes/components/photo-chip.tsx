import type { ComponentProps } from "react";
import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

/**
 * A 28 pt pill over a photo; the position comes from `className`. A plain view rather than a native
 * glass host: a host view lags behind the page's scroll, so the pill drifts off its corner.
 */
export function PhotoChip({
  label,
  icon,
  semibold,
  className,
}: {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  semibold?: boolean;
  className: string;
}) {
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <View
      className={`bg-surface/85 border-border h-7 flex-row items-center gap-[5px] rounded-full border pr-2.5 ${icon ? "pl-2" : "pl-2.5"} ${className}`}
      pointerEvents="none"
    >
      {icon ? <Ionicons color={foreground} name={icon} size={14} /> : null}
      <Text className={`text-foreground text-[13px] ${semibold ? "font-semibold" : "font-medium"}`}>
        {label}
      </Text>
    </View>
  );
}
