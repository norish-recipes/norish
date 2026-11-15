import React from "react";
import { View } from "react-native";
import { CardPhoto } from "@/components/card-photo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { isRecipeItem } from "@norish/shared-react/calendar/todays-meals";

/**
 * A planned item's picture: its recipe's photo, or a note's tile with its glyph. `className`
 * sizes and rounds it; on a sheet row the note tile and the photo's ground take the white.
 */
export function PlannedThumb({
  item,
  className,
  onSheet = false,
  glyphSize = 20,
}: {
  item: PlannedItemFromQuery;
  className: string;
  onSheet?: boolean;
  glyphSize?: number;
}) {
  const [muted] = useThemeColor(["muted"] as const);

  return isRecipeItem(item) ? (
    <CardPhoto className={className} image={item.recipeImage} onSheet={onSheet} />
  ) : (
    <View
      className={`${onSheet ? "bg-surface" : "bg-default"} items-center justify-center ${className}`}
    >
      <Ionicons color={muted} name="document-text-outline" size={glyphSize} />
    </View>
  );
}
