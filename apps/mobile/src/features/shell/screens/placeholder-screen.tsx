import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIntl } from "react-intl";

/** A tab whose area hasn't been built yet: its title, nothing else. */
export function PlaceholderScreen({ titleId, testID }: { titleId: string; testID: string }) {
  const intl = useIntl();

  return (
    <SafeAreaView className="bg-background flex-1" testID={testID}>
      <View className="px-5 pt-6">
        <Text className="text-foreground text-3xl font-semibold">
          {intl.formatMessage({ id: titleId })}
        </Text>
      </View>
    </SafeAreaView>
  );
}
