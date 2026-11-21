import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useConfirmedSignOut } from "@/hooks/use-confirmed-sign-out";
import { Button } from "heroui-native";
import { useIntl } from "react-intl";

/** The Settings tab, which holds only Sign-out until the account's rows are built. */
export function SettingsScreen() {
  const intl = useIntl();
  const signOut = useConfirmedSignOut();

  return (
    <SafeAreaView className="bg-background flex-1" testID="settings-screen">
      <View className="gap-6 px-5 pt-6">
        <Text className="text-foreground text-3xl font-semibold">
          {intl.formatMessage({ id: "navbar.userMenu.settings.title" })}
        </Text>
        <Button testID="smoke-sign-out" variant="secondary" onPress={() => void signOut()}>
          <Button.Label>{intl.formatMessage({ id: "navbar.userMenu.logout" })}</Button.Label>
        </Button>
      </View>
    </SafeAreaView>
  );
}
