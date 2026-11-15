import React from "react";
import { Pressable } from "react-native";
import { RoundTick } from "@/components/round-tick";
import { useThemeColor } from "heroui-native";

/** The round tick in the Store's colour, under a 44 pt press target. */
export function StoreTick({
  checked,
  partial = false,
  color,
  label,
  testID,
  onPress,
}: {
  checked: boolean;
  /** Some of a group's lines are ticked and some are not. */
  partial?: boolean;
  /** The Store's colour; the accent where the row has no Store. */
  color: string | undefined;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const [accent] = useThemeColor(["accent"] as const);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: partial ? "mixed" : checked }}
      // The circle is 24 pt; the hit area is the 44 pt a thumb needs.
      className="size-11 items-center justify-center"
      hitSlop={4}
      testID={testID}
      onPress={onPress}
    >
      <RoundTick color={color ?? accent} partial={partial} selected={checked} />
    </Pressable>
  );
}
