import type { ComponentProps } from "react";
import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@/components/icon";
import { useTokenColor } from "@/hooks/use-token-color";

const TONE_TOKEN = { default: "foreground", accent: "accent-text", danger: "danger" } as const;

/** The kit's body icon button: a solid 40 pt circle with a small shadow, never glass; `small` is
 * the 28 pt one on a photo. A `disabled` one is dimmed to 40% and gives no press. */
export function IconButton({
  icon,
  label,
  testID,
  tone = "default",
  small = false,
  disabled = false,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  testID?: string;
  tone?: keyof typeof TONE_TOKEN;
  small?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = useTokenColor(TONE_TOKEN[tone]);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`bg-thumb ${small ? "size-7" : "size-10"} items-center justify-center rounded-full shadow-sm ${disabled ? "opacity-40" : ""}`}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
    >
      <Ionicons color={color} name={icon} size={small ? 14 : 20} />
    </Pressable>
  );
}
