import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Brand } from "@/components/brand";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { MINIMUM_SERVER_VERSION } from "@/features/auth/utils/server-version";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** A dead end: the server is older than this app supports, so sign-in is not offered. */
export function UpdateServerScreen() {
  const intl = useIntl();
  const [foregroundColor] = useThemeColor(["foreground"] as const);

  return (
    <AuthLayout>
      <Brand prefix={intl.formatMessage({ id: "auth.updateServer.title" })} slogan={false} />
      <View className="mt-7 gap-3">
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
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
});
