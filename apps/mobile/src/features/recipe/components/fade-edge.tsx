import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/** The page colour fading in over scrolled content, so a floating bar or header reads on a quiet ground. */
export function FadeEdge({
  edge,
  height,
  color,
  solidFrom = 0.5,
}: {
  edge: "top" | "bottom";
  height: number;
  color: string;
  /** How much of the height is fully the page colour, measured from the edge. */
  solidFrom?: number;
}) {
  const id = `fade-${edge}`;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, height, [edge]: 0 }}
    >
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient
            id={id}
            x1="0"
            x2="0"
            y1={edge === "top" ? "1" : "0"}
            y2={edge === "top" ? "0" : "1"}
          >
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset={1 - solidFrom} stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#${id})`} height="100%" width="100%" />
      </Svg>
    </View>
  );
}
