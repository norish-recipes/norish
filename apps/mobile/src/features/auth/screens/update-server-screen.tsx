import React from "react";
import { StyleSheet, Text } from "react-native";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { MINIMUM_SERVER_VERSION } from "@/features/auth/utils/server-version";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** A dead end: the server is older than this app supports, so sign-in is not offered. */
export function UpdateServerScreen() {
  const intl = useIntl();
  const [foregroundColor] = useThemeColor(["foreground"] as const);

  return (
    <AuthShell headingPrefix={intl.formatMessage({ id: "auth.updateServer.title" })}>
      <Text
        className="font-normal"
        style={[styles.description, { color: foregroundColor }]}
        testID="update-server-description"
      >
        {intl.formatMessage(
          { id: "auth.updateServer.description" },
          { minimumVersion: MINIMUM_SERVER_VERSION }
        )}
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
});
