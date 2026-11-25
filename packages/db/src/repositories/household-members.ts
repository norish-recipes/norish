import { eq } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { householdUsers } from "@norish/db/schema";

/** The household's members, as a subquery for a repository to filter an owner column on. */
export function householdMemberIdsSql(householdId: string) {
  return db
    .select({ userId: householdUsers.userId })
    .from(householdUsers)
    .where(eq(householdUsers.householdId, householdId));
}

export async function getHouseholdMemberIds(householdId: string): Promise<string[]> {
  const rows = await householdMemberIdsSql(householdId);

  return rows.map((row) => row.userId);
}
