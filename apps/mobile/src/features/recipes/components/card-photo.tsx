import React from "react";
import { Image, View } from "react-native";
import { useServerImage } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

/** A recipe's photo, or a plain ground when it has none; the size comes from `className`. */
export function CardPhoto({ image, className }: { image: string | null; className: string }) {
  const toImage = useServerImage();
  const [muted] = useThemeColor(["muted"] as const);

  if (!image) {
    return (
      <View className={`bg-default items-center justify-center ${className}`}>
        <Ionicons color={muted} name="image-outline" size={26} />
      </View>
    );
  }

  return (
    <Image
      className={`bg-default ${className}`}
      resizeMode="cover"
      source={toImage(image)}
    />
  );
}
