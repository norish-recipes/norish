import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccountAvatar } from "@/components/account-avatar";
import { useIntl } from "react-intl";

/** The Recipes tab; Today and the Library arrive with their tickets. */
export function RecipesScreen() {
  const intl = useIntl();

  return (
    <SafeAreaView className="bg-background flex-1" testID="recipes-screen">
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View className="flex-row items-center justify-between px-5 pt-6">
          <Text className="text-foreground text-3xl font-semibold">
            {intl.formatMessage({ id: "navbar.nav.home" })}
          </Text>
          <AccountAvatar />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
