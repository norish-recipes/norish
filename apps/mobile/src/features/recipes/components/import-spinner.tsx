import React, { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";

/** A 38-of-56 arc turning once per 0.9 s while an import runs, still under Reduce Motion. */
export function ImportSpinner({ size }: { size: number }) {
  const color = useAccentTextColor();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.set(withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1));
  }, [reduceMotion, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));

  return (
    <Animated.View style={style}>
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Circle
          cx={12}
          cy={12}
          fill="none"
          r={9}
          stroke={color}
          strokeDasharray="38 100"
          strokeLinecap="round"
          strokeWidth={2.4}
        />
      </Svg>
    </Animated.View>
  );
}
