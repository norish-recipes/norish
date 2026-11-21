import type { ComponentProps } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

type Size = "row" | "footer" | "overlay" | "tag";
type Tone = "default" | "surface" | "warning" | "active" | "expired";

// Fully rounded: the radius is half the height.
const HEIGHT: Record<Size, number> = { row: 24, footer: 22, overlay: 24, tag: 24 };
const PADDING: Record<Size, string> = {
  row: "px-2",
  footer: "px-[7px]",
  overlay: "px-[9px]",
  tag: "px-[9px]",
};
const TEXT: Record<Size, string> = {
  row: "text-[13px]",
  footer: "text-[11px]",
  overlay: "text-xs",
  tag: "text-[13px]",
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

/** A small capsule: a card's fact, tag or allergen warning, or the kit's status `tag`.
 * An `overlay` one sits on a photo, so it casts a shadow; past `maxWidth` the text is cut. */
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
  const muted = useTokenColor("muted");
  const warningForeground = useTokenColor("warning-foreground");

  return (
    <View
      className={`flex-none flex-row items-center ${size === "tag" ? "gap-[5px]" : "gap-1"} ${PADDING[size]} ${GROUND[tone]} ${size === "overlay" ? "shadow-md" : ""}`}
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
