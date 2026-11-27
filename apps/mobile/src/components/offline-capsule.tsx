import React from "react";
import { Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { useText } from "@/lib/i18n/use-text";

import { useConnectivity } from "@norish/shared-react/offline/react";

/** Offline, a glass capsule that says why a settings page's or sheet's changes are off. */
export function OfflineCapsule() {
  const text = useText();
  const { isOffline } = useConnectivity();

  return isOffline ? (
    <View
      className="mt-2 h-[30px] items-center justify-center self-center px-3.5"
      testID="settings-offline"
    >
      <GlassSurface radius={15} />
      <Text className="text-foreground text-[13px] font-medium">
        {text("settings.mobile.offlineReason")}
      </Text>
    </View>
  ) : null;
}
