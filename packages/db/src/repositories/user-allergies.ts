import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { tags, userAllergies, users } from "@norish/db/schema";

import { getOrCreateManyTagsTx } from "./tags";

export async function getUserAllergies(
  userId: string
): Promise<{ allergies: string[]; version: number }> {
  const [userRow, rows] = await Promise.all([
    db
      .select({ version: users.version })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((result) => result[0] ?? null),
    db
      .select({ name: tags.name, version: userAllergies.version })
      .from(userAllergies)
      .innerJoin(tags, eq(userAllergies.tagId, tags.id))
      .where(eq(userAllergies.userId, userId))
      .orderBy(sql`lower(${tags.name})`),
  ]);

  const allergyVersion = rows.reduce((max, row) => Math.max(max, row.version), 0);

  return {
    allergies: rows.map((row) => row.name),
    version: Math.max(userRow?.version ?? 0, allergyVersion),
  };
}

export async function getAllergiesForUsers(
  userIds: string[]
): Promise<{ userId: string; tagName: string }[]> {
  if (userIds.length === 0) return [];

  const rows = await db
    .select({
      userId: userAllergies.userId,
      tagName: tags.name,
    })
    .from(userAllergies)
    .innerJoin(tags, eq(userAllergies.tagId, tags.id))
    .where(inArray(userAllergies.userId, userIds));

  return rows;
}

export async function updateUserAllergies(
  userId: string,
  allergyNames: string[],
  currentVersion: number
): Promise<{ applied: boolean; version: number; stale: boolean }> {
  return await db.transaction(async (tx) => {
    const nextVersion = currentVersion === 0 ? 2 : currentVersion + 1;

    if (currentVersion === 0) {
      const [userRow, existingAllergy] = await Promise.all([
        tx.select({ version: users.version }).from(users).where(eq(users.id, userId)).limit(1),
        tx
          .select({ version: userAllergies.version })
          .from(userAllergies)
          .where(eq(userAllergies.userId, userId))
          .limit(1),
      ]);

      const authoritativeVersion = Math.max(
        userRow[0]?.version ?? 0,
        existingAllergy[0]?.version ?? 0
      );

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
      const [userRow, existingAllergies] = await Promise.all([
        tx.select({ version: users.version }).from(users).where(eq(users.id, userId)).limit(1),
        tx
          .select({ version: userAllergies.version })
          .from(userAllergies)
          .where(eq(userAllergies.userId, userId)),
      ]);

      const authoritativeVersion = Math.max(
        userRow[0]?.version ?? 0,
        ...existingAllergies.map((row) => row.version)
      );

      return { applied: false, version: authoritativeVersion, stale: true };
    }

    // Delete existing allergies
    await tx.delete(userAllergies).where(eq(userAllergies.userId, userId));

    if (allergyNames.length === 0) {
      return { applied: true, version: nextVersion, stale: false };
    }

    // Get or create tags
    const tagRecords = await getOrCreateManyTagsTx(tx, allergyNames);

    // Insert new allergies
    const rows = tagRecords.map((tag) => ({
      userId,
      tagId: tag.id,
      version: nextVersion,
    }));

    await tx.insert(userAllergies).values(rows).onConflictDoNothing();

    return { applied: true, version: nextVersion, stale: false };
  });
}
