import React from "react";
import { Checkbox } from "heroui-native";

/** A round tick for a row that carries the press itself; the row's accessibility state says whether it is ticked. */
export function RoundTick({
  selected,
  sizeClass = "size-6",
}: {
  selected: boolean;
  /** The tick's width and height classes, as they are whole utilities. */
  sizeClass?: "size-6" | "size-[26px]";
}) {
  return (
    <Checkbox
      className={`${sizeClass} rounded-full border-2 bg-transparent shadow-none ${selected ? "border-transparent" : "border-border"}`}
      importantForAccessibility="no-hide-descendants"
      isSelected={selected}
      pointerEvents="none"
    >
      {/* The filled tick is the indicator, whose radius heroui animates to 0 when selected;
          iOS clamps a radius to half the side, so this keeps it a circle. */}
      <Checkbox.Indicator animation={{ borderRadius: { value: [999, 999] } }} />
    </Checkbox>
  );
}
