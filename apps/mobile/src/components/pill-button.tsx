import type { ComponentProps } from "react";
import React from "react";
import { Pressable, Text } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

/** The kit's body pill: a solid 34 pt capsule with a small shadow, an optional accent icon before
 * its label; `danger` makes the label red. */
export function PillButton({
  label,
  icon,
  tone = "default",
  testID,
  onPress,
}: {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  tone?: "default" | "danger";
  testID?: string;
  onPress: () => void;
}) {
  const accentText = useTokenColor("accent-text");

  return (
    <Pressable
      accessibilityRole="button"
      className="bg-thumb h-[34px] flex-row items-center gap-[7px] self-start rounded-full px-3.5 shadow-sm"
      testID={testID}
      onPress={onPress}
    >
      {icon ? <Ionicons color={accentText} name={icon} size={17} /> : null}
      <Text
        className={`text-[15px] font-medium ${tone === "danger" ? "text-danger" : "text-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
