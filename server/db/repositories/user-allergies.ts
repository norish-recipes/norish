import { eq, inArray, sql } from "drizzle-orm";

import { getOrCreateManyTags } from "./tags";

import { db } from "@/server/db/drizzle";
import { userAllergies, tags } from "@/server/db/schema";

export async function getUserAllergies(userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(userAllergies)
    .innerJoin(tags, eq(userAllergies.tagId, tags.id))
    .where(eq(userAllergies.userId, userId))
    .orderBy(sql`lower(${tags.name})`);

  return rows.map((r) => r.name);
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

export async function updateUserAllergies(userId: string, allergyNames: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete existing allergies
    await tx.delete(userAllergies).where(eq(userAllergies.userId, userId));

    if (allergyNames.length === 0) return;

    // Get or create tags
    const tagRecords = await getOrCreateManyTags(allergyNames);

    // Insert new allergies
    const rows = tagRecords.map((tag) => ({
      userId,
      tagId: tag.id,
    }));

    await tx.insert(userAllergies).values(rows).onConflictDoNothing();
  });
}
