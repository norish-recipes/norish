import React from "react";
import { cookModeRoute, recipeIdOf } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { AccessoryProps } from "../utils/accessory-plan";
import { AccessoryAction } from "./accessory-action";

/** The bottom accessory on a recipe: Cook opens that recipe's cook mode. */
export function CookAccessory({ inline, path }: AccessoryProps) {
  const intl = useIntl();
  const router = useRouter();
  const recipeId = recipeIdOf(path);

  return (
    <AccessoryAction
      icon="play-circle-outline"
      inline={inline}
      label={intl.formatMessage({ id: "recipes.detail.cook" })}
      testID="cook-recipe"
      onPress={() => recipeId && router.push(cookModeRoute(recipeId))}
    />
  );
}
