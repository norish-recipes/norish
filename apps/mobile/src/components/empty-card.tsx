import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

type Tone = "accent" | "shop" | "warning";

const GROUND: Record<Tone, string> = {
  accent: "bg-accent/10",
  shop: "bg-shop/25",
  warning: "bg-warning/20",
};
const INK: Record<Tone, string> = { accent: "accent-text", shop: "shop-ink", warning: "warning" };

/** A list with nothing in it: the area's icon in its tint on the left, title and at most one line
 * on the right, and an optional action under them. A sheet passes its own `className` fill. */
export function EmptyCard({
  icon,
  tone = "accent",
  title,
  description,
  className = "bg-surface mx-5",
  testID,
  children,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  tone?: Tone;
  title: string;
  description?: string;
  className?: string;
  testID: string;
  children?: ReactNode;
}) {
  const ink = useTokenColor(INK[tone]);

  return (
    <View className={`${className} gap-3.5 rounded-3xl p-[18px]`} testID={testID}>
      <View className="flex-row items-center gap-3.5">
        <View className={`${GROUND[tone]} size-12 items-center justify-center rounded-full`}>
          <Ionicons color={ink} name={icon} size={22} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-foreground text-lg font-semibold">{title}</Text>
          {description ? (
            <Text className="text-muted text-[15px] leading-[21px]">{description}</Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}
