import React from "react";
import { Pressable } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
      <MaterialCommunityIcons color={muted} name="drag" size={22} />
    </Pressable>
  );
}
