import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { tags, userAllergies, users } from "@norish/db/schema";

import { getOrCreateManyTagsTx } from "./tags";

async function readUserAllergies(
  connection: Pick<typeof db, "select">,
  userId: string
): Promise<{ allergies: string[]; version: number }> {
  const rows = await connection
    .select({ name: tags.name, version: users.version, allergyVersion: userAllergies.version })
    .from(users)
    .leftJoin(userAllergies, eq(userAllergies.userId, users.id))
    .leftJoin(tags, eq(userAllergies.tagId, tags.id))
    .where(eq(users.id, userId))
    .orderBy(sql`lower(${tags.name})`);

  return {
    allergies: rows.flatMap(({ name }) => (name === null ? [] : [name])),
    version: rows.reduce((max, row) => Math.max(max, row.version, row.allergyVersion ?? 0), 0),
  };
}

export function getUserAllergies(userId: string) {
  return readUserAllergies(db, userId);
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

    // A stored name sent back keeps its tag as stored; only new names are cleaned into tags.
    const stored = await tx
      .select({ id: tags.id, name: tags.name })
      .from(userAllergies)
      .innerJoin(tags, eq(userAllergies.tagId, tags.id))
      .where(eq(userAllergies.userId, userId));
    const sent = new Set(allergyNames.map((name) => name.toLowerCase()));
    const kept = stored.filter((tag) => sent.has(tag.name.toLowerCase()));
    const keptNames = new Set(kept.map((tag) => tag.name.toLowerCase()));

    await tx.delete(userAllergies).where(eq(userAllergies.userId, userId));

    const added = await getOrCreateManyTagsTx(
      tx,
      allergyNames.filter((name) => !keptNames.has(name.toLowerCase()))
    );
    const rows = [...kept, ...added].map((tag) => ({
      userId,
      tagId: tag.id,
      version: nextVersion,
    }));

    if (rows.length > 0) await tx.insert(userAllergies).values(rows).onConflictDoNothing();

    return { applied: true, version: nextVersion, stale: false };
  });
}
