import { foldPendingListEntries } from "@norish/db/repositories/upgrades";
import { dbLogger as log } from "@norish/shared-server/logger";

/** Tag, Cuisine and Category names from before 0.28 SQL cannot fold take `entryFold` (ADR-0043);
 * null once none waits. Each kind folds in one transaction, so a crash leaves none half done. */
export async function upgradeHouseholdLists(): Promise<number | null> {
  const folded = await foldPendingListEntries();

  if (folded === 0) return null;
  log.info({ folded }, "Folded list names from before 0.28");

  return folded;
}
