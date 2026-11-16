import React from "react";
import { Pressable } from "react-native";
import { useServerImage } from "@/lib/network/server-url";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Avatar } from "heroui-native";

import { useReader } from "@norish/shared-react/reader";

/** The signed-in Reader's avatar, at the top of the tabs; it opens Settings. */
export function AccountAvatar() {
  const router = useRouter();
  const { user } = useReader();
  const toImage = useServerImage();
  const name = user?.name ?? "";

  return (
    <Pressable
      accessibilityRole="button"
      testID="account-avatar"
      onPress={() => router.navigate("/settings")}
    >
      <Avatar alt={name} className="size-9">
        {user?.image ? (
          <Avatar.Image asChild source={toImage(user.image)}>
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
          </Avatar.Image>
        ) : null}
        <Avatar.Fallback
          classNames={{ container: "bg-avatar", text: "text-foreground text-base font-semibold" }}
        >
          {name.slice(0, 1).toUpperCase()}
        </Avatar.Fallback>
      </Avatar>
    </Pressable>
  );
}
