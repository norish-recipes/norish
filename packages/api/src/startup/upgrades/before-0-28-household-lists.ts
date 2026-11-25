import { foldPendingListEntries } from "@norish/db/repositories/upgrades";

/** Tag, Cuisine and Category names from before 0.28 that SQL cannot fold take `entryFold` (ADR-0043). */
export async function upgradeHouseholdLists(): Promise<number> {
  return await foldPendingListEntries();
}
