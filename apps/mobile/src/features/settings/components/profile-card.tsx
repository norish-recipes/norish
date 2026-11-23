import React from "react";
import { Pressable, Text, View } from "react-native";
import { useServerImage } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Avatar, useThemeColor } from "heroui-native";

/** The Reader's avatar, name and email as the Profile row at the top of Settings. */
export function ProfileCard({
  name,
  email,
  image,
  onPress,
}: {
  name: string;
  email: string;
  image: string | null;
  onPress: () => void;
}) {
  const toImage = useServerImage();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityRole="button"
      className="active:bg-default min-h-[76px] flex-row items-center gap-3.5 px-4"
      testID="settings-profile"
      onPress={onPress}
    >
      <Avatar alt={name} className="size-[52px]">
        {image ? (
          <Avatar.Image asChild source={toImage(image)}>
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
          </Avatar.Image>
        ) : null}
        <Avatar.Fallback
          classNames={{
            container: "bg-avatar",
            text: "text-foreground text-[22px] font-semibold",
          }}
        >
          {name.slice(0, 1).toUpperCase()}
        </Avatar.Fallback>
      </Avatar>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-foreground text-lg font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-muted text-sm" numberOfLines={1}>
          {email}
        </Text>
      </View>
      <Ionicons color={muted} name="chevron-forward" size={16} />
    </Pressable>
  );
}
