import React from "react";
import { Alert, Pressable, StyleSheet } from "react-native";
import { useNetworkStatus } from "@/context/network-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/**
 * Small status icon that appears in the navigation header when the app
 * is not fully online. Tap to see an alert with details.
 */
export function OfflineBanner() {
  const { mode, runtimeState } = useNetworkStatus();
  const intl = useIntl();
  const [warningColor, mutedColor] = useThemeColor(["warning", "muted"] as const);

  if (runtimeState !== "ready" || mode === "online") {
    return null;
  }

  const isOffline = mode === "offline";
  const iconName = isOffline ? "cloud-offline-outline" : "warning-outline";
  const iconColor = isOffline ? mutedColor : warningColor;
  const message = isOffline
    ? intl.formatMessage({ id: "common.connection.offlineBanner" })
    : intl.formatMessage({ id: "common.connection.serverUnreachableBanner" });

  function handlePress() {
    Alert.alert(
      isOffline
        ? intl.formatMessage({ id: "common.connection.checkInternet" })
        : intl.formatMessage({ id: "common.connection.connecting" }),
      message
    );
  }

  return (
    <Pressable onPress={handlePress} style={styles.button} hitSlop={8}>
      <Ionicons name={iconName} size={20} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 6,
  },
});
