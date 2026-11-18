import type { ComponentProps } from "react";
import React from "react";
import { Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

type Size = "row" | "footer" | "overlay";
type Tone = "default" | "surface" | "warning";

// Fully rounded: the ground's and the glass's radius are both half the height.
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
};

/** A card's small capsule: a fact, a tag, or an allergen warning, sized by the card's `size`.
 * `glass` lays native glass in place of the ground, over a photo; past `maxWidth` the text is cut. */
export function Pill({
  children,
  icon,
  size,
  tone = "default",
  glass = false,
  maxWidth,
}: {
  children: string | number;
  icon?: ComponentProps<typeof Ionicons>["name"];
  size: Size;
  tone?: Tone;
  glass?: boolean;
  maxWidth?: number;
}) {
  const [muted, warning, warningForeground] = useThemeColor([
    "muted",
    "warning",
    "warning-foreground",
  ] as const);

  return (
    <View
      className={`flex-none flex-row items-center gap-1 ${PADDING[size]} ${glass ? "" : GROUND[tone]}`}
      style={{ height: HEIGHT[size], borderRadius: HEIGHT[size] / 2, maxWidth }}
    >
      {glass ? (
        <GlassSurface radius={HEIGHT[size] / 2} tint={tone === "warning" ? warning : undefined} />
      ) : null}
      {icon ? (
        <Ionicons
          color={tone === "warning" ? warningForeground : muted}
          name={icon}
          size={size === "footer" ? 11 : 13}
        />
      ) : null}
      <Text
        className={`shrink ${TEXT[size]} ${tone === "warning" ? "text-warning-foreground font-semibold" : "text-foreground"}`}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
}
