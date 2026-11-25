import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { householdUsers, userAllergies, users } from "@norish/db/schema";
import { entryFold } from "@norish/shared/lib/fold-name";

import { entryName } from "./list-entries";

async function readUserAllergies(
  connection: Pick<typeof db, "select">,
  userId: string
): Promise<{ allergies: string[]; version: number }> {
  const rows = await connection
    .select({
      name: userAllergies.name,
      version: users.version,
      allergyVersion: userAllergies.version,
    })
    .from(users)
    .leftJoin(userAllergies, eq(userAllergies.userId, users.id))
    .where(eq(users.id, userId))
    .orderBy(sql`lower(${userAllergies.name})`);

  return {
    allergies: rows.flatMap(({ name }) => (name === null ? [] : [name])),
    version: rows.reduce((max, row) => Math.max(max, row.version, row.allergyVersion ?? 0), 0),
  };
}

export function getUserAllergies(userId: string) {
  return readUserAllergies(db, userId);
}

/** Every allergy the household's members keep, one name per fold, by name. */
export async function getHouseholdAllergyNames(householdId: string): Promise<string[]> {
  const rows = await db
    .select({ name: userAllergies.name })
    .from(userAllergies)
    .innerJoin(householdUsers, eq(householdUsers.userId, userAllergies.userId))
    .where(eq(householdUsers.householdId, householdId))
    .orderBy(asc(sql`lower(${userAllergies.name})`), asc(userAllergies.name));
  const byFold = new Map<string, string>();

  for (const { name } of rows) if (!byFold.has(entryFold(name))) byFold.set(entryFold(name), name);

  return [...byFold.values()];
}

export async function updateUserAllergies(
  userId: string,
  allergyNames: string[],
  currentVersion: number
): Promise<{ applied: boolean; version: number; stale: boolean }> {
  return await db.transaction(async (tx) => {
    const nextVersion = currentVersion === 0 ? 2 : currentVersion + 1;

    if (currentVersion === 0) {
      const { version: authoritativeVersion } = await readUserAllergies(tx, userId);

      if (authoritativeVersion !== 1) {
        return { applied: false, version: authoritativeVersion, stale: true };
      }
    }

    const [updatedUser] = await tx
      .update(users)
      .set({ version: nextVersion })
      .where(
        and(eq(users.id, userId), eq(users.version, currentVersion === 0 ? 1 : currentVersion))
      )
      .returning({ version: users.version });

    if (!updatedUser) {
      const { version: authoritativeVersion } = await readUserAllergies(tx, userId);

      return { applied: false, version: authoritativeVersion, stale: true };
    }

    // A sent name folding like a stored one keeps the stored spelling; new names are cleaned.
    const stored = await tx
      .select({ name: userAllergies.name })
      .from(userAllergies)
      .where(eq(userAllergies.userId, userId));
    const storedByFold = new Map(stored.map(({ name }) => [entryFold(name), name]));
    const kept = new Map<string, string>();

    for (const sent of allergyNames) {
      const name = storedByFold.get(entryFold(sent)) ?? entryName(sent)?.name;

      if (name && !kept.has(entryFold(name))) kept.set(entryFold(name), name);
    }

    await tx.delete(userAllergies).where(eq(userAllergies.userId, userId));

    if (kept.size > 0) {
      await tx
        .insert(userAllergies)
        .values([...kept.values()].map((name) => ({ userId, name, version: nextVersion })))
        .onConflictDoNothing();
    }

    return { applied: true, version: nextVersion, stale: false };
  });
}
