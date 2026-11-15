import type { BadgeTiming } from "@/features/auth/utils/badge-motion";
import type { ReactNode } from "react";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import {
  BADGE_START_DELAY_MS,
  badgeArrow,
  badgeRing,
  badgeShake,
  STRIKE_TIMING,
  UPDATE_TIMING,
} from "@/features/auth/utils/badge-motion";
import { playBadge } from "@/features/auth/utils/motion";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useIntl } from "react-intl";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Danger and warning with their soft grounds, in sRGB; the light warning is darker than the theme's.
const TONES = {
  warning: {
    light: { color: "rgb(198, 108, 0)", soft: "rgba(255, 156, 61, 0.18)" },
    dark: { color: "rgb(255, 175, 91)", soft: "rgba(255, 175, 91, 0.16)" },
  },
  danger: {
    light: { color: "rgb(207, 40, 69)", soft: "rgba(207, 40, 69, 0.12)" },
    dark: { color: "rgb(245, 107, 124)", soft: "rgba(245, 107, 124, 0.16)" },
  },
};

type Variant = {
  tone: keyof typeof TONES;
  timing: BadgeTiming;
  /** The glyph's arrow rises and drops back; only Update your server's does. */
  arrow?: boolean;
  glyph: ReactNode;
  labelId: string;
};

const VARIANTS = {
  update: {
    tone: "warning",
    timing: UPDATE_TIMING,
    arrow: true,
    glyph: <Circle cx={12} cy={12} r={10} />,
    labelId: "auth.updateServer.badgeLabel",
  },
  failed: {
    tone: "danger",
    timing: STRIKE_TIMING,
    glyph: (
      <>
        <Circle cx={12} cy={12} r={10} />
        <Path d="m15 9-6 6" />
        <Path d="m9 9 6 6" />
      </>
    ),
    labelId: "auth.signInFailed.badgeLabel",
  },
  storage: {
    tone: "warning",
    timing: STRIKE_TIMING,
    glyph: (
      <>
        <Rect height={11} rx={2} width={18} x={3} y={11} />
        <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    labelId: "common.storageUnavailable.badgeLabel",
  },
} satisfies Record<string, Variant>;

type StatusBadgeVariant = keyof typeof VARIANTS;

const GLYPH = "translate(19 19) scale(1.4167)";
const GLYPH_PROPS = {
  fill: "none",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** A status screen's badge: one shake, one ring and, for Update your server, the arrow's failed rise; a tap replays it. */
export function StatusBadge({ variant }: { variant: StatusBadgeVariant }) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const { tone, timing, arrow, glyph, labelId }: Variant = VARIANTS[variant];
  const { color, soft } = TONES[tone][useResolvedColorScheme()];
  const clock = useSharedValue(timing.ms);

  useEffect(() => {
    if (!reduceMotion) playBadge(clock, timing.ms, BADGE_START_DELAY_MS);
  }, [clock, reduceMotion, timing.ms]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: badgeShake(clock.get(), timing) }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: badgeArrow(clock.get()) }],
  }));
  const ringProps = useAnimatedProps(() => badgeRing(clock.get(), timing));

  return (
    <Pressable
      accessibilityLabel={intl.formatMessage({ id: labelId })}
      accessibilityRole="image"
      className="size-[72px]"
      onPress={() => {
        if (!reduceMotion) playBadge(clock, timing.ms, 0);
      }}
    >
      <View pointerEvents="none" style={styles.ring}>
        <Svg height={160} width={160}>
          <AnimatedCircle
            animatedProps={ringProps}
            cx={80}
            cy={80}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        </Svg>
      </View>
      <Animated.View style={[styles.fill, shakeStyle]}>
        <Glyph color={color} ground={soft}>
          {glyph}
        </Glyph>
        {arrow ? (
          <Animated.View style={[styles.fill, arrowStyle]}>
            <Glyph color={color}>
              <Path d="m16 12-4-4-4 4" />
              <Path d="M12 16V8" />
            </Glyph>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/** The 24-unit glyph on the 72pt badge, over its soft ground when given. */
function Glyph({
  color,
  ground,
  children,
}: {
  color: string;
  ground?: string;
  children: ReactNode;
}) {
  return (
    <Svg height={72} width={72}>
      {ground ? <Circle cx={36} cy={36} fill={ground} r={36} /> : null}
      <G {...GLYPH_PROPS} stroke={color} transform={GLYPH}>
        {children}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  // The 160pt ring canvas, centred on the 72pt badge.
  ring: { position: "absolute", left: -44, top: -44 },
  fill: StyleSheet.absoluteFill,
});
