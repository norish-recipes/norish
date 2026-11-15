import React from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

/** The heart a favourite wears on its photo. */
export function FavouriteMark({ size }: { size: number }) {
  const [danger] = useThemeColor(["danger"] as const);

  return (
    <View
      className="bg-surface/80 absolute top-2 left-2 items-center justify-center rounded-full"
      style={{ width: size, height: size }}
      testID="favourite-mark"
    >
      <Ionicons color={danger} name="heart" size={size * 0.55} />
    </View>
  );
}
