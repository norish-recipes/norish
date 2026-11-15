import type { ComponentProps } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";

/** A centred card for a list with nothing in it: an icon, a title and at most one line under it. */
export function EmptyCard({
  icon,
  title,
  description,
  testID,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description?: string;
  testID: string;
}) {
  const accentText = useAccentTextColor();

  return (
    <View
      className="bg-surface mx-5 items-center gap-2 rounded-[26px] px-7 pt-8 pb-7"
      testID={testID}
    >
      <View className="bg-accent/10 mb-2 size-16 items-center justify-center rounded-[20px]">
        <Ionicons color={accentText} name={icon} size={30} />
      </View>
      <Text className="text-foreground text-xl font-semibold">{title}</Text>
      {description ? (
        <Text className="text-muted text-center text-[15px] leading-[21px]">{description}</Text>
      ) : null}
    </View>
  );
}
