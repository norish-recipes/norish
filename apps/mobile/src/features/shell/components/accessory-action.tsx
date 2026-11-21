import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { labelFits } from "@/lib/label-fits";
import { closeOpenRow } from "@/lib/open-row";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useIntl } from "react-intl";

import type { Action } from "../utils/accessory-plan";
import { ACTION_CHROME, ACTION_ICON } from "../utils/accessory-plan";

/** One action in the accessory: its icon and label, the label dropped beside the minimised tab bar
 * when its measured width does not fit the room the timer leaves. */
export function AccessoryAction({ action: { icon, labelId, testID, route } }: { action: Action }) {
  const intl = useIntl();
  const router = useRouter();
  const inline = NativeTabs.BottomAccessory.usePlacement() === "inline";
  const label = intl.formatMessage({ id: labelId });
  const accent = useAccentTextColor();
  const [room, setRoom] = useState<number | null>(null);
  const [labelWidth, setLabelWidth] = useState<number | null>(null);
  const fits = inline ? labelFits(room, labelWidth, ACTION_CHROME) : true;

  return (
    <Pressable
      // Named outright: VoiceOver would read the icon font's glyph too.
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-full flex-row items-center justify-center gap-2"
      testID={testID}
      onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      onPress={() => {
        closeOpenRow();
        router.push(route);
      }}
    >
      <Ionicons color={accent} name={icon} size={ACTION_ICON} />
      {/* Unmeasured, it keeps its place unseen: drawn first and dropped after, it would flash. */}
      {fits !== false ? (
        <Text
          className={`text-foreground text-base font-semibold ${fits === null ? "opacity-0" : ""}`}
          numberOfLines={1}
        >
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
