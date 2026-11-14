import React from "react";
import { useOwnerRights } from "@/hooks/use-owner-rights";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useCookbookAddRecipes, useCookbookQuery } from "@norish/shared-react/recipes";

import { RecipePickSheet } from "../components/recipe-pick";

function AddRecipesSheet({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const intl = useIntl();
  const router = useRouter();
  const { addable, hasRecipes, save, ...pick } = useCookbookAddRecipes(cookbook);

  return (
    <RecipePickSheet
      action={{
        label:
          pick.selected.length > 0
            ? intl.formatMessage(
                { id: "recipes.cookbooks.addCount" },
                { count: pick.selected.length }
              )
            : intl.formatMessage({ id: "common.actions.add" }),
        icon: "add",
        testID: "cookbook-add-recipes-add",
        onPress:
          pick.selected.length === 0
            ? undefined
            : () => {
                save();
                router.back();
              },
      }}
      emptyId={
        hasRecipes ? "recipes.cookbooks.everythingAlreadyIn" : "recipes.cookbooks.noRecipesToAdd"
      }
      name="cookbook-add-recipes"
      pick={{ ...pick, recipes: addable }}
      subtitle={cookbook.title}
      title={intl.formatMessage({ id: "recipes.cookbooks.addRecipes" })}
    />
  );
}

/** Add recipes: search what the cookbook does not hold, tick any number, then Add; inert without edit rights. */
export function CookbookAddRecipesScreen() {
  const intl = useIntl();
  const { cookbookId, title } = useLocalSearchParams<{ cookbookId: string; title?: string }>();
  const { cookbook } = useCookbookQuery(cookbookId ?? "");
  const { canEdit } = useOwnerRights();

  return cookbook && canEdit(cookbook) ? (
    <AddRecipesSheet key={cookbook.id} cookbook={cookbook} />
  ) : (
    <RecipePickSheet
      action={{
        label: intl.formatMessage({ id: "common.actions.add" }),
        icon: "add",
        testID: "cookbook-add-recipes-add",
      }}
      emptyId="recipes.cookbooks.noRecipesToAdd"
      name="cookbook-add-recipes"
      subtitle={title}
      title={intl.formatMessage({ id: "recipes.cookbooks.addRecipes" })}
    />
  );
}
