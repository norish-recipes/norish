import React from "react";
import Svg, { Circle } from "react-native-svg";

/** A countdown's ring: the share of the timer left, drawn clockwise from the top. */
export function TimerRing({
  size,
  stroke,
  left,
  color,
}: {
  size: number;
  stroke: number;
  /** 0 to 1. */
  left: number;
  color: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;

  return (
    <Svg height={size} width={size}>
      <Circle
        cx={centre}
        cy={centre}
        fill="none"
        r={radius}
        stroke={color}
        strokeOpacity={0.25}
        strokeWidth={stroke}
      />
      <Circle
        cx={centre}
        cy={centre}
        fill="none"
        r={radius}
        stroke={color}
        strokeDasharray={`${circumference * Math.min(Math.max(left, 0), 1)} ${circumference}`}
        strokeLinecap="round"
        strokeWidth={stroke}
        transform={`rotate(-90 ${centre} ${centre})`}
      />
    </Svg>
  );
}
