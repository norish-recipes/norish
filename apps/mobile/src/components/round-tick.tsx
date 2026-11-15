import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Checkbox } from "heroui-native";

/** A round tick for a row that carries the press itself; the row's accessibility state says whether it is ticked. */
export function RoundTick({
  selected,
  sizeClass = "size-6",
  color,
  partial = false,
}: {
  selected: boolean;
  /** The tick's width and height classes, as they are whole utilities. */
  sizeClass?: "size-6" | "size-[26px]";
  /** Rings and fills the tick in this colour instead of the theme's. */
  color?: string;
  /** Some of a group's lines are ticked: filled with a dash. */
  partial?: boolean;
}) {
  const filled = selected || partial;

  return (
    <Checkbox
      className={`${sizeClass} rounded-full border-2 bg-transparent shadow-none ${filled ? "border-transparent" : "border-border"}`}
      importantForAccessibility="no-hide-descendants"
      isSelected={filled}
      pointerEvents="none"
      style={color ? { borderColor: color } : undefined}
    >
      {/* The filled tick is the indicator, whose radius heroui animates to 0 when selected;
          iOS clamps a radius to half the side, so this keeps it a circle. */}
      <Checkbox.Indicator
        animation={{ borderRadius: { value: [999, 999] } }}
        style={color ? { backgroundColor: color } : undefined}
      >
        {partial ? <Ionicons color="#ffffff" name="remove" size={14} /> : undefined}
      </Checkbox.Indicator>
    </Checkbox>
  );
}
