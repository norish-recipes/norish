import React from "react";
import { cookModeRoute } from "@/lib/tab-routes";
import { Stack, useRouter } from "expo-router";
import { useIntl } from "react-intl";

/** The page's foot, a native toolbar: Home back to the Recipes tab and Cook, centred. */
export function RecipeToolbar({ recipeId }: { recipeId: string }) {
  const intl = useIntl();
  const router = useRouter();

  return (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button
        accessibilityLabel={intl.formatMessage({ id: "navbar.nav.home" })}
        icon="house"
        onPress={() => router.navigate("/")}
      />
      <Stack.Toolbar.Button
        variant="prominent"
        onPress={() => router.push(cookModeRoute(recipeId))}
      >
        {intl.formatMessage({ id: "recipes.detail.cook" })}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Spacer />
    </Stack.Toolbar>
  );
}
