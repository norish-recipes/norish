import React from "react";
import { Pressable, View } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";

/** The check circle: 24 pt, ringed in the Store's colour and filled with a 14 pt check once ticked. */
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
  const accent = useAccentTextColor();
  const tint = color ?? accent;
  const filled = checked || partial;

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
      <View
        className="size-6 items-center justify-center rounded-full border-2"
        style={{ borderColor: tint, backgroundColor: filled ? tint : "transparent" }}
      >
        {filled ? (
          <Ionicons color="#ffffff" name={partial ? "remove" : "checkmark"} size={14} />
        ) : null}
      </View>
    </Pressable>
  );
}
