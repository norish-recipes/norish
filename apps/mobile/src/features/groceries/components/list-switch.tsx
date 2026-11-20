import type { GroceriesSection } from "@/lib/groceries-section";
import type { DerivedValue } from "react-native-reanimated";
import React from "react";
import { View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";
import { Segmented } from "@/components/segmented";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useIntl } from "react-intl";

// The switch's height, over which it fades as it rises under the bar.
const SWITCH_HEIGHT = 44;

/** The switch between the list and the Pantry, drawn once over both lists so its thumb slides while
 * the page does; it rides `offset`, the shown list's scroll, as if it sat in that list's header. */
export function ListSwitch({
  section,
  offset,
  top,
  onChange,
}: {
  section: GroceriesSection;
  offset: DerivedValue<number>;
  top: number;
  onChange: (section: GroceriesSection) => void;
}) {
  const intl = useIntl();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get(), [0, SWITCH_HEIGHT], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: -offset.get() }],
    // Faded under the bar, it no longer takes the bar's touches.
    pointerEvents: offset.get() >= SWITCH_HEIGHT ? ("none" as const) : ("box-none" as const),
  }));

  return (
    <Animated.View className="absolute inset-x-0 z-10 px-5" style={[{ top }, style]}>
      <Segmented
        segments={[
          {
            value: "list",
            label: intl.formatMessage({ id: "groceries.page.title" }),
            icon: (color) => (
              <MaterialCommunityIcons color={color} name="clipboard-check-outline" size={20} />
            ),
            testID: "groceries-switch-list",
          },
          {
            value: "pantry",
            label: intl.formatMessage({ id: "groceries.page.pantry" }),
            icon: (color) => (
              <MaterialCommunityIcons color={color} name="archive-outline" size={20} />
            ),
            testID: "groceries-switch-pantry",
          },
        ]}
        testID="groceries-switch"
        value={section}
        onChange={onChange}
      />
    </Animated.View>
  );
}

/** The room atop each list's header that the switch rides over: its height and the gap below it. */
export function ListSwitchSpace() {
  return <View style={{ height: SWITCH_HEIGHT + 20 }} />;
}
