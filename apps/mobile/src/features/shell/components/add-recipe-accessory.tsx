import React from "react";
import { useOwnerRights } from "@/hooks/use-owner-rights";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { usePathname, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useCookbookQuery } from "@norish/shared-react/recipes";

import type { AccessoryProps } from "../utils/accessory-plan";
import { AccessoryAction } from "./accessory-action";

/** The bottom accessory: Add recipes opens the picker on a cookbook the Reader may edit; elsewhere
 * Add recipe opens the Add recipe sheet. */
export function AddRecipeAccessory({ inline }: AccessoryProps) {
  const intl = useIntl();
  const router = useRouter();
  const pathId = /^\/cookbook\/([^/]+)$/.exec(usePathname())?.[1];
  const { cookbook } = useCookbookQuery(pathId ?? "");
  const { canEdit } = useOwnerRights();
  const cookbookId = cookbook && canEdit(cookbook) ? cookbook.id : undefined;

  return (
    <AccessoryAction
      icon="add-circle-outline"
      inline={inline}
      label={intl.formatMessage({
        id: cookbookId ? "recipes.cookbooks.addRecipes" : "recipes.dashboard.addRecipe",
      })}
      testID={cookbookId ? "cookbook-add-recipes-accessory" : "add-recipe"}
      onPress={() =>
        cookbookId
          ? router.push({ pathname: TAB_ROUTES.recipes.cookbookAddRecipes, params: { cookbookId } })
          : router.push("/add-recipe")
      }
    />
  );
}
