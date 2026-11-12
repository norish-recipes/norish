import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";
import {
  BADGE_MS,
  BADGE_START_DELAY_MS,
  badgeArrow,
  badgeRing,
  badgeShake,
} from "@/features/auth/utils/badge-motion";
import { playBadge } from "@/features/auth/utils/motion";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useIntl } from "react-intl";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// The board's warning and its soft ground, in sRGB (the light warning is darker than the theme's).
const COLORS = {
  light: { warning: "rgb(198, 108, 0)", soft: "rgba(255, 156, 61, 0.18)" },
  dark: { warning: "rgb(255, 175, 91)", soft: "rgba(255, 175, 91, 0.16)" },
};
const GLYPH = "translate(19 19) scale(1.4167)";
const GLYPH_PROPS = {
  fill: "none",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** The warning badge: one failed rise of the arrow, one shake, one ring; a tap replays it. */
export function UpdateBadge() {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const { warning, soft } = COLORS[useResolvedColorScheme() === "dark" ? "dark" : "light"];
  const clock = useSharedValue(BADGE_MS);

  useEffect(() => {
    if (!reduceMotion) playBadge(clock, BADGE_MS, BADGE_START_DELAY_MS);
  }, [clock, reduceMotion]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: badgeShake(clock.get()) }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: badgeArrow(clock.get()) }],
  }));
  const ringProps = useAnimatedProps(() => badgeRing(clock.get()));

  return (
    <Pressable
      accessibilityLabel={intl.formatMessage({ id: "auth.updateServer.badgeLabel" })}
      accessibilityRole="image"
      className="size-[72px]"
      onPress={() => {
        if (!reduceMotion) playBadge(clock, BADGE_MS, 0);
      }}
    >
      <View pointerEvents="none" style={styles.ring}>
        <Svg height={160} width={160}>
          <AnimatedCircle
            animatedProps={ringProps}
            cx={80}
            cy={80}
            fill="none"
            stroke={warning}
            strokeWidth={2}
          />
        </Svg>
      </View>
      <Animated.View style={[styles.fill, shakeStyle]}>
        <Svg height={72} width={72}>
          <Circle cx={36} cy={36} fill={soft} r={36} />
          <G {...GLYPH_PROPS} stroke={warning} transform={GLYPH}>
            <Circle cx={12} cy={12} r={10} />
          </G>
        </Svg>
        <Animated.View style={[styles.fill, arrowStyle]}>
          <Svg height={72} width={72}>
            <G {...GLYPH_PROPS} stroke={warning} transform={GLYPH}>
              <Path d="m16 12-4-4-4 4" />
              <Path d="M12 16V8" />
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The board's 160pt ring canvas, centred on the 72pt badge.
  ring: { position: "absolute", left: -44, top: -44 },
  fill: StyleSheet.absoluteFill,
});
