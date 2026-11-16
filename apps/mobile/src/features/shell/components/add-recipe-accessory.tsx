import React from "react";
import { useOwnerRights } from "@/hooks/use-owner-rights";
import { cookbookIdOf, TAB_ROUTES } from "@/lib/tab-routes";

import { useCookbookQuery } from "@norish/shared-react/recipes";

import type { Action } from "../utils/accessory-plan";
import { AccessoryAction } from "./accessory-action";

/** The bottom accessory: Add recipes opens the picker on a cookbook the Reader may edit; elsewhere
 * Add recipe opens the Add recipe sheet. */
export function AddRecipeAccessory({ path }: { path: string }) {
  const { cookbook } = useCookbookQuery(cookbookIdOf(path) ?? "");
  const { canEdit } = useOwnerRights();
  const action: Action =
    cookbook && canEdit(cookbook)
      ? {
          icon: "add-circle-outline",
          labelId: "recipes.cookbooks.addRecipes",
          testID: "cookbook-add-recipes-accessory",
          route: {
            pathname: TAB_ROUTES.recipes.cookbookAddRecipes,
            params: { cookbookId: cookbook.id },
          },
        }
      : {
          icon: "add-circle-outline",
          labelId: "recipes.dashboard.addRecipe",
          testID: "add-recipe",
          route: "/add-recipe",
        };

  return <AccessoryAction action={action} />;
}
