import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ACTION_ICON, labelFits } from "../utils/accessory-plan";

/** One action in the accessory: its icon and label, the label dropped inline when its measured
 * width does not fit the room the timer leaves. */
export function AccessoryAction({
  icon,
  label,
  inline,
  testID,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  inline: boolean;
  testID: string;
  onPress: () => void;
}) {
  const accent = useAccentTextColor();
  const [room, setRoom] = useState<number | null>(null);
  const [labelWidth, setLabelWidth] = useState<number | null>(null);
  const showLabel = !inline || labelFits(room, labelWidth);

  return (
    <Pressable
      // Named outright: VoiceOver would read the icon font's glyph too.
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-full flex-row items-center justify-center gap-2"
      testID={testID}
      onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      onPress={onPress}
    >
      <Ionicons color={accent} name={icon} size={ACTION_ICON} />
      {showLabel ? (
        <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      {/* An unconstrained hidden copy reports the label's own width, shown or not. */}
      <View
        accessibilityElementsHidden
        className="absolute top-0 left-0 w-[1000px] flex-row opacity-0"
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <Text
          className="text-base font-semibold"
          numberOfLines={1}
          onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
