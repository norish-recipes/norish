import React from "react";
import { View } from "react-native";
import { useGroupedFill } from "@/components/on-sheet";
import { ServerImage } from "@/components/server-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

/** A recipe's photo, or a plain ground when it has none; the size comes from `className`. */
export function CardPhoto({ image, className }: { image: string | null; className: string }) {
  const ground = useGroupedFill();
  const [muted] = useThemeColor(["muted"] as const);

  if (!image) {
    return (
      <View className={`${ground} items-center justify-center ${className}`}>
        <Ionicons color={muted} name="image-outline" size={26} />
      </View>
    );
  }

  return <ServerImage className={`${ground} ${className}`} contentFit="cover" path={image} />;
}
