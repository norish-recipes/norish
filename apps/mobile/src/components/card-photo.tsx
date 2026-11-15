import React from "react";
import { Image, View } from "react-native";
import { useServerImage } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

/** A recipe's photo, or a plain ground when it has none; the size comes from `className`. */
export function CardPhoto({
  image,
  className,
  onSheet,
}: {
  image: string | null;
  className: string;
  /** On a sheet row, whose fill is the neutral one, so the ground takes the white. */
  onSheet?: boolean;
}) {
  const ground = onSheet ? "bg-surface" : "bg-default";
  const toImage = useServerImage();
  const [muted] = useThemeColor(["muted"] as const);

  if (!image) {
    return (
      <View className={`${ground} items-center justify-center ${className}`}>
        <Ionicons color={muted} name="image-outline" size={26} />
      </View>
    );
  }

  return <Image className={`${ground} ${className}`} resizeMode="cover" source={toImage(image)} />;
}
