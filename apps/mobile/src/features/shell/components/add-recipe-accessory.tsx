import React from "react";
import { Pressable, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/**
 * The label the tab bar's bottom accessory draws. On a cookbook's page it reads Add recipes and
 * opens that cookbook's picker; elsewhere it reads Add recipe and opens the Add recipe sheet.
 */
export function AddRecipeAccessory() {
  const intl = useIntl();
  const router = useRouter();
  const [accent] = useThemeColor(["accent"] as const);
  const cookbookId = /^\/cookbook\/([^/]+)$/.exec(usePathname())?.[1];
  const label = intl.formatMessage({
    id: cookbookId ? "recipes.cookbooks.addRecipes" : "recipes.dashboard.addRecipe",
  });

  return (
    <Pressable
      // Named outright: VoiceOver would read the icon font's glyph too.
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-full flex-row items-center justify-center gap-2"
      testID={cookbookId ? "cookbook-add-recipes-accessory" : "add-recipe"}
      onPress={() =>
        cookbookId
          ? router.push({ pathname: "/cookbook-add-recipes", params: { cookbookId } })
          : router.push("/add-recipe")
      }
    >
      <Ionicons color={accent} name="add-circle-outline" size={22} />
      <Text className="text-foreground text-base font-semibold">{label}</Text>
    </Pressable>
  );
}
