import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

/** Write it yourself: a placeholder until the Recipe area brings the editor; its name is the header's. */
export default function NewRecipeRoute() {
  const intl = useIntl();

  return (
    <View className="bg-background flex-1" testID="new-recipe-placeholder">
      <Stack.Screen
        options={{ headerTitle: intl.formatMessage({ id: "navbar.userMenu.newRecipe.title" }) }}
      />
    </View>
  );
}
