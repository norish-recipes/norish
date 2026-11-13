import React, { use } from "react";
import { Pressable } from "react-native";
import { ServerAddressContext } from "@/lib/network/server-address";
import { serverUrl } from "@/lib/network/server-url";
import { useRouter } from "expo-router";
import { Avatar } from "heroui-native";

import { useReader } from "@norish/shared-react/reader";

/** The signed-in Reader's avatar, at the top of the tabs; it opens Settings. */
export function AccountAvatar() {
  const router = useRouter();
  const { user } = useReader();
  const address = use(ServerAddressContext);

  return (
    <Pressable
      accessibilityRole="button"
      testID="account-avatar"
      onPress={() => router.navigate("/settings")}
    >
      <Avatar alt={user?.name ?? ""} size="md">
        {user?.image ? <Avatar.Image source={{ uri: serverUrl(address, user.image) }} /> : null}
        <Avatar.Fallback>{(user?.name ?? "").slice(0, 1).toUpperCase()}</Avatar.Fallback>
      </Avatar>
    </Pressable>
  );
}
