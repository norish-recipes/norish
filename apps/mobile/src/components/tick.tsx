import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Checkbox, useThemeColor } from "heroui-native";

/** The kit's multi-select tick, a circle, for a row that carries the press itself; the row's accessibility state says whether it is ticked. */
export function Tick({
  selected,
  color,
  partial = false,
}: {
  selected: boolean;
  /** Rings and fills the tick in this colour instead of the theme's. */
  color?: string;
  /** Some of a group's lines are ticked: filled with a dash. */
  partial?: boolean;
}) {
  const filled = selected || partial;
  const [onFill] = useThemeColor(["accent-foreground"] as const);

  return (
    <Checkbox
      className={`size-6 rounded-full border-2 bg-transparent shadow-none ${filled ? "border-transparent" : "border-tick-border"}`}
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
        {partial ? <Ionicons color={onFill} name="remove" size={14} /> : undefined}
      </Checkbox.Indicator>
    </Checkbox>
  );
}
