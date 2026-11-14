import React from "react";
import { Image, View } from "react-native";
import { useServerImage } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { coverMosaicColumns } from "@norish/shared-react/recipes";

/** A cookbook's cover: its own photo, else a mosaic of up to four members' photos. */
export function CookbookCover({
  cookbook,
  className,
  iconSize = 26,
  onSheet,
}: {
  cookbook: CookbookSummaryDTO;
  className: string;
  /** The book shown while the cookbook has no photo to draw. */
  iconSize?: number;
  /** On a sheet row, whose fill is the neutral one, so the ground takes the white. */
  onSheet?: boolean;
}) {
  const ground = onSheet ? "bg-surface" : "bg-default";
  const toImage = useServerImage();
  const [muted] = useThemeColor(["muted"] as const);
  const photos = cookbook.image ? [cookbook.image] : cookbook.coverImages.slice(0, 4);
  const tile = (uri: string, tileClass: string) => (
    <Image key={uri} className={`${ground} ${tileClass}`} source={toImage(uri)} />
  );

  if (photos.length === 0) {
    return (
      <View className={`${ground} items-center justify-center ${className}`}>
        <Ionicons color={muted} name="book-outline" size={iconSize} />
      </View>
    );
  }

  return (
    <View className={`flex-row gap-0.5 overflow-hidden ${className}`}>
      {coverMosaicColumns(photos.length).map((rows) => (
        <View key={rows.join()} className="flex-1 gap-0.5">
          {rows.map((index) => tile(photos[index] ?? "", "w-full flex-1"))}
        </View>
      ))}
    </View>
  );
}
