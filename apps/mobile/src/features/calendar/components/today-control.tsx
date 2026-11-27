import React from "react";
import { Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { GlassPill } from "@/components/glass";
import { Ionicons } from "@/components/icon";
import { lightImpact } from "@/lib/haptics";
import { FADE_REDUCED_IN, FADE_REDUCED_OUT } from "@/lib/motion/layout";
import { springTo } from "@/lib/motion/spring";
import { useTabBarMinimised } from "@/lib/tab-accessory-placement";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { todayControlPlace } from "../utils/today-control";

// Stiffer than the app's spring and still critically damped: the pill pops rather than grows.
const POP = { damping: 49, stiffness: 600 };
const POP_IN = ZoomIn.springify().damping(POP.damping).stiffness(POP.stiffness);
const POP_OUT = ZoomOut.springify().damping(POP.damping).stiffness(POP.stiffness);

/** The largest text scale a 44 pt pill holds whole. */
const PILL_TEXT_SCALE = 2;

/** A glass Today at the list's bottom right, above the accessory wherever UIKit places it and
 * moving with it, while today's card is off screen; it points the way to it. */
export function TodayControl({
  direction,
  homeIndicator,
  onPress,
}: {
  direction: "up" | "down" | null;
  homeIndicator: number;
  onPress: () => void;
}) {
  const intl = useIntl();
  const minimised = useTabBarMinimised();
  const reduceMotion = useReducedMotion();
  const [foreground] = useThemeColor(["foreground"] as const);
  const { right, bottom } = todayControlPlace(homeIndicator, minimised);
  // Springs on the edges: a transform or layout move left the pill's glass blank. Reduce Motion jumps.
  const lift = useDerivedValue(() => (reduceMotion ? bottom : springTo(bottom)));
  const inset = useDerivedValue(() => (reduceMotion ? right : springTo(right)));
  const placeStyle = useAnimatedStyle(() => ({ bottom: lift.get(), right: inset.get() }));

  return (
    // Pinned top and left too: sized by the pill, the box shrank into its corner on exit and the
    // zooming-out pill slid along with it.
    <Animated.View
      className="absolute top-0 left-0 items-end justify-end"
      pointerEvents="box-none"
      style={placeStyle}
    >
      {direction ? (
        <Animated.View
          entering={reduceMotion ? FADE_REDUCED_IN : POP_IN}
          exiting={reduceMotion ? FADE_REDUCED_OUT : POP_OUT}
        >
          <GlassPill
            accessibilityLabel={intl.formatMessage({ id: "calendar.mobile.scrollToToday" })}
            className="flex-row items-center gap-1.5 pr-4 pl-3"
            testID="calendar-to-today"
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
      ) : null}
    </Animated.View>
  );
}
