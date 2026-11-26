import type { ComponentProps } from "react";
import React from "react";
import { Pressable, Text } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

const TONE_TEXT = {
  default: "text-foreground font-medium",
  danger: "text-danger font-medium",
  accent: "text-accent-foreground font-semibold",
} as const;

/** The kit's body pill: a solid 34 pt capsule with a small shadow, an optional accent icon before
 * its label; `danger` makes the label red, `accent` a solid accent 36 pt capsule. It sits at the
 * start of its row, or `centred` on it. */
export function PillButton({
  label,
  icon,
  tone = "default",
  centred = false,
  testID,
  onPress,
}: {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  tone?: "default" | "danger" | "accent";
  centred?: boolean;
  testID?: string;
  onPress: () => void;
}) {
  const accentText = useTokenColor("accent-text");

  return (
    <Pressable
      accessibilityRole="button"
      className={`flex-row items-center gap-[7px] ${centred ? "self-center" : "self-start"} rounded-full shadow-sm ${tone === "accent" ? "bg-accent h-9 px-[15px]" : "bg-thumb h-[34px] px-3.5"}`}
      testID={testID}
      onPress={onPress}
    >
      {icon ? <Ionicons color={accentText} name={icon} size={17} /> : null}
      <Text className={`text-[15px] ${TONE_TEXT[tone]}`}>{label}</Text>
    </Pressable>
  );
}
