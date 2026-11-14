import React from "react";
import { Pressable, Text } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { useOwnerRights } from "@/hooks/use-owner-rights";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useCookbookQuery } from "@norish/shared-react/recipes";

/**
 * The tab bar's bottom accessory: Add recipes opens the picker on a cookbook the Reader may edit;
 * everywhere else Add recipe opens the Add recipe sheet.
 */
export function AddRecipeAccessory() {
  const intl = useIntl();
  const router = useRouter();
  const accent = useAccentTextColor();
  const pathId = /^\/cookbook\/([^/]+)$/.exec(usePathname())?.[1];
  const { cookbook } = useCookbookQuery(pathId ?? "");
  const { canEdit } = useOwnerRights();
  const cookbookId = cookbook && canEdit(cookbook) ? cookbook.id : undefined;
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
