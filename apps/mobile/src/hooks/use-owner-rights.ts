import { useRecipePermissions } from "@norish/shared-react/reader";

type Owned = { householdId: string };

/** Whether the Reader may edit or delete a recipe or cookbook; cookbooks answer to the recipe policy. */
export function useOwnerRights() {
  const { canEditRecipe, canDeleteRecipe } = useRecipePermissions();

  return {
    canEdit: (owned: Owned) => canEditRecipe(owned.householdId),
    canDelete: (owned: Owned) => canDeleteRecipe(owned.householdId),
  };
}
