import { getHouseholdIdForUser } from "@norish/db/repositories/households";

import { unrecoverable } from "./create-worker";

/** The importer's household as the job runs; the one it was queued in may be left since. */
export async function importerHouseholdId(userId: string): Promise<string> {
  const householdId = await getHouseholdIdForUser(userId);

  if (!householdId) throw unrecoverable(new Error("The importing account no longer exists"));

  return householdId;
}
