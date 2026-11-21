import React from "react";
import Animated from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { useSpinStyle } from "@/lib/motion/spin";

/** A drawn arc, not the shared loader: it marks one import card's work in the accent colour.
 * It turns once per 0.9 s and stays still under Reduce Motion. */
export function ImportSpinner({ size }: { size: number }) {
  const color = useAccentTextColor();
  const style = useSpinStyle(900);

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
