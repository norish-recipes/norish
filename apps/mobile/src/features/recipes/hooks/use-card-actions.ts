import { useOwnerRights } from "@/hooks/use-owner-rights";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import {
  useCookbookRecipesQuery,
  useCookbooksMutations,
  useFavoritesMutation,
  useRecipeMutationErrorToast,
  useRecipesMutations,
} from "@norish/shared-react/recipes";

import { useConfirm } from "./use-confirm";

type Recipe = Pick<RecipeDashboardDTO, "id" | "name" | "version" | "userId">;
type Cookbook = Pick<CookbookSummaryDTO, "id" | "title" | "version" | "userId">;

/**
 * What a recipe or cookbook card can do; writes are shared mutations, so offline they queue in the
 * Outbox. Given the `cookbook` the cards are shown in, a recipe can also be taken out of it.
 */
export function useCardActions(cookbook?: CookbookSummaryDTO) {
  const intl = useIntl();
  const router = useRouter();
  const { toggleFavorite } = useFavoritesMutation();
  const { deleteRecipes } = useRecipesMutations(useRecipeMutationErrorToast());
  const { setMembership, deleteCookbook } = useCookbooksMutations();
  const { canEdit, canDelete } = useOwnerRights();
  // The page's member list is this cookbook's own read, so a removal drops the card now rather
  // than waiting for a refetch that Offline never comes.
  const { removeMember } = useCookbookRecipesQuery(cookbook?.id ?? "", {}, { enabled: false });

  const confirm = useConfirm();

  return {
    canDelete,
    canEdit,
    toggleFavourite: (recipe: Recipe) => toggleFavorite(recipe.id),
    addToGroceries: (recipe: Recipe) =>
      router.push({ pathname: "/add-to-groceries", params: { recipeId: recipe.id } }),
    plan: (recipe: Recipe) =>
      router.push({ pathname: "/plan", params: { recipeId: recipe.id, name: recipe.name } }),
    addToCookbook: (recipe: Recipe) =>
      router.push({
        pathname: "/add-to-cookbook",
        params: { recipeId: recipe.id, name: recipe.name },
      }),
    canRemoveFromCookbook: cookbook ? canEdit(cookbook) : false,
    removeFromCookbook: (recipe: Recipe) => {
      if (!cookbook) return;

      setMembership({ cookbookId: cookbook.id, recipeIds: [recipe.id], isMember: false, cookbook });
      removeMember(recipe.id);
    },
    deleteRecipe: (recipe: Recipe) =>
      confirm({
        title: intl.formatMessage({ id: "recipes.deleteModal.alertTitle" }, { name: recipe.name }),
        message: intl.formatMessage({ id: "recipes.deleteModal.warning" }),
        onConfirm: () => deleteRecipes([{ id: recipe.id, version: recipe.version }]),
      }),
    addRecipes: (cookbook: Cookbook) =>
      router.push({
        pathname: "/cookbook-add-recipes",
        params: { cookbookId: cookbook.id, title: cookbook.title },
      }),
    renameCookbook: (cookbook: Cookbook) =>
      router.push({ pathname: "/cookbook-rename", params: { cookbookId: cookbook.id } }),
    deleteCookbook: (cookbook: Cookbook, onDeleted?: () => void) =>
      confirm({
        title: intl.formatMessage(
          { id: "recipes.cookbooks.deleteAlertTitle" },
          { title: cookbook.title }
        ),
        message: intl.formatMessage({ id: "recipes.cookbooks.deleteKeepsRecipes" }),
        onConfirm: () => {
          deleteCookbook({ id: cookbook.id, version: cookbook.version });
          onDeleted?.();
        },
      }),
  };
}

export type CardActions = ReturnType<typeof useCardActions>;
