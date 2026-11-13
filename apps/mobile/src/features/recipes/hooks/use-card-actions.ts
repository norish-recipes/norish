import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import { ownerAllows, useRecipePermissions } from "@norish/shared-react/reader";
import {
  useCookbooksMutations,
  useFavoritesMutation,
  useRecipeMutationErrorToast,
  useRecipesMutations,
} from "@norish/shared-react/recipes";

type Recipe = Pick<RecipeDashboardDTO, "id" | "name" | "version" | "userId">;
type Cookbook = Pick<CookbookSummaryDTO, "id" | "title" | "version" | "userId">;

/** What a recipe or cookbook card can do; writes are shared mutations, so offline they queue in the Outbox. */
export function useCardActions() {
  const intl = useIntl();
  const router = useRouter();
  const { toggleFavorite } = useFavoritesMutation();
  const { deleteRecipes } = useRecipesMutations(useRecipeMutationErrorToast());
  const { setMembership, deleteCookbook } = useCookbooksMutations();
  const { canEditRecipe, canDeleteRecipe } = useRecipePermissions();

  // The native alert: destructive button on the right, as the board draws it.
  const confirm = (title: string, message: string, onConfirm: () => void) =>
    Alert.alert(title, message, [
      { text: intl.formatMessage({ id: "common.actions.cancel" }), style: "cancel" },
      {
        text: intl.formatMessage({ id: "common.actions.delete" }),
        style: "destructive",
        onPress: onConfirm,
      },
    ]);

  return {
    canDelete: (owned: Pick<Recipe, "userId">) => ownerAllows(owned.userId, canDeleteRecipe),
    canEdit: (owned: Pick<Recipe, "userId">) => ownerAllows(owned.userId, canEditRecipe),
    toggleFavourite: (recipe: Recipe) => toggleFavorite(recipe.id),
    addToGroceries: (recipe: Recipe) =>
      router.push({ pathname: "/add-to-groceries", params: { recipeId: recipe.id } }),
    plan: (recipe: Recipe) => router.push({ pathname: "/plan", params: { recipeId: recipe.id } }),
    addToCookbook: (recipe: Recipe) =>
      router.push({ pathname: "/add-to-cookbook", params: { recipeId: recipe.id } }),
    removeFromCookbook: (cookbook: Cookbook, recipe: Recipe) =>
      setMembership({ cookbookId: cookbook.id, recipeIds: [recipe.id], isMember: false }),
    deleteRecipe: (recipe: Recipe) =>
      confirm(
        intl.formatMessage({ id: "recipes.deleteModal.alertTitle" }, { name: recipe.name }),
        intl.formatMessage({ id: "recipes.deleteModal.warning" }),
        () => deleteRecipes([{ id: recipe.id, version: recipe.version }])
      ),
    addRecipes: (cookbook: Cookbook) =>
      router.push({ pathname: "/cookbook-add-recipes", params: { cookbookId: cookbook.id } }),
    renameCookbook: (cookbook: Cookbook) =>
      router.push({ pathname: "/cookbook-rename", params: { cookbookId: cookbook.id } }),
    deleteCookbook: (cookbook: Cookbook) =>
      confirm(
        intl.formatMessage({ id: "recipes.cookbooks.deleteAlertTitle" }, { title: cookbook.title }),
        intl.formatMessage({ id: "recipes.cookbooks.deleteKeepsRecipes" }),
        () => deleteCookbook({ id: cookbook.id, version: cookbook.version })
      ),
  };
}

export type CardActions = ReturnType<typeof useCardActions>;
