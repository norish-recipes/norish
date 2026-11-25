import { eq, inArray } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { householdUsers } from "@norish/db/schema";

/** The household's members, as a subquery for a repository to filter an owner column on. */
export function householdMemberIdsSql(householdId: string) {
  return db
    .select({ userId: householdUsers.userId })
    .from(householdUsers)
    .where(eq(householdUsers.householdId, householdId));
}

export async function getHouseholdMemberIdsByHouseholdId(householdId: string): Promise<string[]> {
  const rows = await householdMemberIdsSql(householdId);

  return rows.map((row) => row.userId);
}

/** Everyone in the account's household, the account included. */
export async function getHouseholdMemberIdsByUserId(userId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: householdUsers.userId })
    .from(householdUsers)
    .where(
      inArray(
        householdUsers.householdId,
        db
          .select({ householdId: householdUsers.householdId })
          .from(householdUsers)
          .where(eq(householdUsers.userId, userId))
      )
    );

  return rows.map((row) => row.userId);
}
