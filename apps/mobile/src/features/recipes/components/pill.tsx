import type { ComponentProps } from "react";
import React from "react";
import { Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

type Size = "row" | "footer" | "overlay";
type Tone = "default" | "surface" | "warning";

const BOX: Record<Size, string> = {
  row: "h-6 gap-1 rounded-xl px-2",
  footer: "h-[22px] gap-1 rounded-[11px] px-[7px]",
  overlay: "h-6 gap-1 rounded-xl px-[9px]",
};
const TEXT: Record<Size, string> = {
  row: "text-[13px]",
  footer: "text-[11px]",
  overlay: "text-xs",
};
const RADIUS: Record<Size, number> = { row: 12, footer: 11, overlay: 12 };
const GROUND: Record<Tone, string> = {
  default: "bg-default",
  surface: "bg-surface",
  warning: "bg-warning",
};

/** A card's small capsule: a fact, a tag, or an allergen warning, sized by the card's `size`.
 * `glass` lays native glass in place of the ground, for a chip over a photo; a warning tints it. */
export function Pill({
  children,
  icon,
  size,
  tone = "default",
  glass = false,
}: {
  children: string | number;
  icon?: ComponentProps<typeof Ionicons>["name"];
  size: Size;
  tone?: Tone;
  glass?: boolean;
}) {
  const [muted, warning, warningForeground] = useThemeColor([
    "muted",
    "warning",
    "warning-foreground",
  ] as const);

  return (
    <View className={`flex-none flex-row items-center ${BOX[size]} ${glass ? "" : GROUND[tone]}`}>
      {glass ? (
        <GlassSurface radius={RADIUS[size]} tint={tone === "warning" ? warning : undefined} />
      ) : null}
      {icon ? (
        <Ionicons
          color={tone === "warning" ? warningForeground : muted}
          name={icon}
          size={size === "footer" ? 11 : 13}
        />
      ) : null}
      <Text
        className={`${TEXT[size]} ${tone === "warning" ? "text-warning-foreground font-semibold" : "text-foreground"}`}
      >
        {children}
      </Text>
    </View>
  );
}
