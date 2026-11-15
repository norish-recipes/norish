import React from "react";
import { Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

/** The grip a row is dragged by: a hold lifts it. */
export function DragGrip({
  label,
  testID,
  onDrag,
}: {
  label: string;
  testID?: string;
  onDrag: () => void;
}) {
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityLabel={label}
      className="size-8 items-center justify-center"
      delayLongPress={120}
      hitSlop={6}
      testID={testID}
      onLongPress={onDrag}
    >
      <Ionicons color={muted} name="reorder-three" size={22} />
    </Pressable>
  );
}
