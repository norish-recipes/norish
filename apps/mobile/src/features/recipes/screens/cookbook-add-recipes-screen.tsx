import React from "react";
import { useOwnerRights } from "@/hooks/use-owner-rights";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useCookbookAddRecipes, useCookbookQuery } from "@norish/shared-react/recipes";

import { PickSheet } from "../components/pick-sheet";
import { recipePickList, SearchRecipes } from "../components/recipe-pick";

function AddRecipesSheet({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const intl = useIntl();
  const router = useRouter();
  const { input, setInput, addable, hasRecipes, isLoading, loadMore, selected, toggle, save } =
    useCookbookAddRecipes(cookbook);

  return (
    <PickSheet
      action={{
        label:
          selected.length > 0
            ? intl.formatMessage({ id: "recipes.cookbooks.addCount" }, { count: selected.length })
            : intl.formatMessage({ id: "common.actions.add" }),
        icon: "add",
        testID: "cookbook-add-recipes-add",
        onPress:
          selected.length === 0
            ? undefined
            : () => {
                save();
                router.back();
              },
      }}
      header={<SearchRecipes value={input} onChange={setInput} />}
      list={
        isLoading
          ? undefined
          : recipePickList({
              intl,
              recipes: addable,
              emptyId: hasRecipes
                ? "recipes.cookbooks.everythingAlreadyIn"
                : "recipes.cookbooks.noRecipesToAdd",
              selected,
              onToggle: toggle,
              onEndReached: loadMore,
            })
      }
      name="cookbook-add-recipes"
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
    <PickSheet
      action={{
        label: intl.formatMessage({ id: "common.actions.add" }),
        icon: "add",
        testID: "cookbook-add-recipes-add",
      }}
      header={<SearchRecipes />}
      name="cookbook-add-recipes"
      subtitle={title}
      title={intl.formatMessage({ id: "recipes.cookbooks.addRecipes" })}
    />
  );
}
