import { ownerAllows, useRecipePermissions } from "@norish/shared-react/reader";

type Owned = { userId?: string | null };

/** Whether the Reader may edit or delete a recipe or cookbook; cookbooks answer to the recipe policy. */
export function useOwnerRights() {
  const { canEditRecipe, canDeleteRecipe } = useRecipePermissions();

  return {
    canEdit: (owned: Owned) => ownerAllows(owned.userId, canEditRecipe),
    canDelete: (owned: Owned) => ownerAllows(owned.userId, canDeleteRecipe),
  };
}
