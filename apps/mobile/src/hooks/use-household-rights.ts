import { useRecipePermissions } from "@norish/shared-react/reader";

type HouseholdRow = { householdId: string };

/** Whether the Reader may edit or delete a recipe or cookbook of a household; cookbooks answer to
 * the recipe policy. */
export function useHouseholdRights() {
  const { canEditRecipe, canDeleteRecipe } = useRecipePermissions();

  return {
    canEdit: (row: HouseholdRow) => canEditRecipe(row.householdId),
    canDelete: (row: HouseholdRow) => canDeleteRecipe(row.householdId),
  };
}
