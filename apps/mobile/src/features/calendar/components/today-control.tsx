import React from "react";
import { Text } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { GlassPill } from "@/components/glass";
import { lightImpact } from "@/lib/haptics";
import {
  FADE_REDUCED_IN,
  FADE_REDUCED_OUT,
  SPRING_ZOOM_IN,
  SPRING_ZOOM_OUT,
} from "@/lib/motion/layout";
import { accessoryTop } from "@/lib/tab-bar-placement";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** The clear space between the control and the accessory under it. */
const ABOVE_ACCESSORY = 12;
/** The largest text scale a 44 pt pill holds whole. */
const PILL_TEXT_SCALE = 2;

/** A glass Today over the list's foot, above the accessory wherever the bar sits, while today's
 * card is off screen; it points the way to it. */
export function TodayControl({
  direction,
  homeIndicator,
  minimised,
  onPress,
}: {
  direction: "up" | "down" | null;
  homeIndicator: number;
  minimised: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const [foreground, background] = useThemeColor(["foreground", "background"] as const);

  if (!direction) return null;

  return (
    <Animated.View
      className="absolute inset-x-0 items-center"
      entering={reduceMotion ? FADE_REDUCED_IN : SPRING_ZOOM_IN}
      exiting={reduceMotion ? FADE_REDUCED_OUT : SPRING_ZOOM_OUT}
      pointerEvents="box-none"
      style={{ bottom: accessoryTop(homeIndicator, minimised) + ABOVE_ACCESSORY }}
    >
      <GlassPill
        accessibilityLabel={intl.formatMessage({ id: "calendar.mobile.scrollToToday" })}
        className="h-11 flex-row items-center gap-1.5 rounded-full pr-4 pl-3"
        radius={22}
        testID="calendar-to-today"
        tint={background}
        onPress={() => {
          lightImpact();
          onPress();
        }}
      >
        <Ionicons
          color={foreground}
          name={direction === "up" ? "arrow-up" : "arrow-down"}
          size={16}
        />
        <Text
          className="text-foreground text-[15px] font-semibold"
          maxFontSizeMultiplier={PILL_TEXT_SCALE}
        >
          {intl.formatMessage({ id: "calendar.mobile.today" })}
        </Text>
      </GlassPill>
    </Animated.View>
  );
}
