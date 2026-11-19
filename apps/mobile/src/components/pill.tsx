import type { ComponentProps } from "react";
import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

type Size = "row" | "footer" | "overlay";
type Tone = "default" | "surface" | "warning" | "active" | "expired";

// Fully rounded: the radius is half the height.
const HEIGHT: Record<Size, number> = { row: 24, footer: 22, overlay: 24 };
const PADDING: Record<Size, string> = { row: "px-2", footer: "px-[7px]", overlay: "px-[9px]" };
const TEXT: Record<Size, string> = {
  row: "text-[13px]",
  footer: "text-[11px]",
  overlay: "text-xs",
};
const GROUND: Record<Tone, string> = {
  default: "bg-default",
  surface: "bg-surface",
  warning: "bg-warning",
  active: "bg-accent",
  expired: "bg-shop",
};
const LABEL: Record<Tone, string> = {
  default: "text-foreground",
  surface: "text-foreground",
  warning: "text-warning-foreground font-semibold",
  active: "text-accent-foreground font-semibold",
  expired: "text-shop-foreground font-semibold",
};

/** A card's small capsule: a fact, a tag, an allergen warning, or a kit status (`active`, `expired`),
 * sized by the card's `size`.
 * An `overlay` chip sits on a photo, so it casts a shadow; past `maxWidth` the text is cut. */
export function Pill({
  children,
  icon,
  size,
  tone = "default",
  maxWidth,
  testID,
}: {
  children: string | number;
  icon?: ComponentProps<typeof Ionicons>["name"];
  size: Size;
  tone?: Tone;
  maxWidth?: number;
  testID?: string;
}) {
  const [muted, warningForeground] = useThemeColor(["muted", "warning-foreground"] as const);

  return (
    <View
      className={`flex-none flex-row items-center gap-1 ${PADDING[size]} ${GROUND[tone]} ${size === "overlay" ? "shadow-md" : ""}`}
      style={{ height: HEIGHT[size], borderRadius: HEIGHT[size] / 2, maxWidth }}
      testID={testID}
    >
      {icon ? (
        <Ionicons
          color={tone === "warning" ? warningForeground : muted}
          name={icon}
          size={size === "footer" ? 11 : 13}
        />
      ) : null}
      <Text className={`shrink ${TEXT[size]} ${LABEL[tone]}`} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}
