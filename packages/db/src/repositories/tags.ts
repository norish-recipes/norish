import { asc, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import type { TagDto } from "@norish/shared/contracts/dto/tag";
import { db } from "@norish/db/drizzle";
import { recipeTags, tags } from "@norish/db/schema";
import { TagSelectBaseSchema } from "@norish/shared/contracts/zod";
import { stripHtmlTags } from "@norish/shared/lib/helpers";

const TagArraySchema = z.array(TagSelectBaseSchema);

export async function listAllTagNames(): Promise<string[]> {
  // Only return tags that are actually used by at least one recipe
  // NOTE: PostgreSQL's SELECT DISTINCT requires ORDER BY expressions to be in the select list
  const lowerName = sql<string>`lower(${tags.name})`.as("lower_name");
  const rows = await db
    .selectDistinct({ name: tags.name, lowerName })
    .from(tags)
    .innerJoin(recipeTags, eq(tags.id, recipeTags.tagId))
    .orderBy(lowerName);

  return rows.map((r) => r.name).filter(Boolean);
}

function ensureNonEmptyName(name: string): string {
  const cleaned = stripHtmlTags(name);

  if (cleaned.length === 0) throw new Error("Tag name cannot be empty");

  return cleaned;
}

export async function findTagById(id: string): Promise<TagDto | null> {
  const rows = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  const parsed = TagSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
}

export async function findTagByName(name: string): Promise<TagDto | null> {
  const cleaned = ensureNonEmptyName(name);
  const rows = await db
    .select()
    .from(tags)
    // Compare case-insensitively; stored value remains original case
    .where(eq(sql`lower(${tags.name})`, cleaned.toLowerCase()))
    .limit(1);

  const parsed = TagSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
}

export async function createTag(name: string): Promise<TagDto> {
  const cleaned = ensureNonEmptyName(name);

  await db.insert(tags).values({ name: cleaned }).onConflictDoNothing();

  const after = await findTagByName(cleaned);

  if (!after) throw new Error("Failed to create or fetch tag");

  return after;
}

export async function getOrCreateTagByName(name: string): Promise<TagDto> {
  const cleaned = ensureNonEmptyName(name);

  const existing = await findTagByName(cleaned);

  if (existing) return existing;

  return createTag(cleaned);
}

export async function getOrCreateManyTags(names: string[]): Promise<TagDto[]> {
  const cleaned = names.map(stripHtmlTags).filter((n) => n.length > 0);

  if (cleaned.length === 0) return [];

  return await db.transaction(async (tx) => {
    await tx
      .insert(tags)
      .values(cleaned.map((name) => ({ name })))
      .onConflictDoNothing();

    const lowers = Array.from(new Set(cleaned.map((n) => n.toLowerCase())));
    const rows = await tx
      .select()
      .from(tags)
      .where(inArray(sql`lower(${tags.name})`, lowers));

    const parsed = TagArraySchema.safeParse(rows);

    if (!parsed.success) throw new Error("Failed to parse tags");

    return parsed.data;
  });
}

export async function getOrCreateManyTagsTx(tx: any, names: string[]): Promise<TagDto[]> {
  const cleaned = names.map(stripHtmlTags).filter((n) => n.length > 0);

  if (cleaned.length === 0) return [];

  await tx
    .insert(tags)
    .values(cleaned.map((name: string) => ({ name })))
    .onConflictDoNothing();

  const lowers = Array.from(new Set(cleaned.map((n) => n.toLowerCase())));
  const rows = await tx
    .select()
    .from(tags)
    .where(inArray(sql`lower(${tags.name})`, lowers));

  const parsed = TagArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse tags (tx)");

  return parsed.data;
}

export async function attachTagsToRecipeTx(
  tx: any,
  recipeId: string,
  tagIds: string[],
  startOrder: number = 0
): Promise<void> {
  if (!tagIds.length) return;

  const rows = tagIds.map((tagId: string, index: number) => ({
    recipeId,
    tagId,
    order: startOrder + index,
  }));

  await tx.insert(recipeTags).values(rows).onConflictDoNothing();
}

export async function attachTagsToRecipeByInputTx(
  tx: any,
  recipeId: string,
  tagNames: string[]
): Promise<void> {
  // Delete existing tags for this recipe first
  await tx.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId));

  if (!tagNames.length) return;

  const created = await getOrCreateManyTagsTx(tx, tagNames);

  // Build a map from lowercase tag name to tag id for matching
  const tagNameToId = new Map<string, string>();

  for (const tag of created) {
    tagNameToId.set(tag.name.toLowerCase(), tag.id);
  }

  // Create rows preserving the original order from tagNames
  const rows = tagNames
    .map((name, index) => {
      const tagId = tagNameToId.get(name.toLowerCase());

      if (!tagId) return null;

      return { recipeId, tagId, order: index };
    })
    .filter((row): row is { recipeId: string; tagId: string; order: number } => row !== null);

  if (rows.length > 0) {
    await tx.insert(recipeTags).values(rows).onConflictDoNothing();
  }
}

export async function getRecipeTagNames(recipeId: string): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(recipeTags)
    .innerJoin(tags, eq(recipeTags.tagId, tags.id))
    .where(eq(recipeTags.recipeId, recipeId))
    .orderBy(asc(recipeTags.order));

  return rows.map((r) => r.name);
}

export async function getRecipeTagNamesTx(tx: any, recipeId: string): Promise<string[]> {
  const rows = await tx
    .select({ name: tags.name })
    .from(recipeTags)
    .innerJoin(tags, eq(recipeTags.tagId, tags.id))
    .where(eq(recipeTags.recipeId, recipeId))
    .orderBy(asc(recipeTags.order));

  return rows.map((r: { name: string }) => r.name);
}

/**
 * Update a tag's name. Returns the updated tag or null if not found.
 * If the new name conflicts with an existing tag (case-insensitive), merge them.
 */
export async function updateTagName(
  oldName: string,
  newName: string
): Promise<{ merged: boolean; newName: string } | null> {
  const cleanedOld = stripHtmlTags(oldName);
  const cleanedNew = ensureNonEmptyName(newName);

  if (cleanedOld.toLowerCase() === cleanedNew.toLowerCase()) {
    // Same name (case-insensitive), just update the casing
    await db
      .update(tags)
      .set({ name: cleanedNew, version: sql`${tags.version} + 1` })
      .where(eq(sql`lower(${tags.name})`, cleanedOld.toLowerCase()));

    return { merged: false, newName: cleanedNew };
  }

  return await db.transaction(async (tx) => {
    // Find the old tag
    const oldTag = await tx
      .select()
      .from(tags)
      .where(eq(sql`lower(${tags.name})`, cleanedOld.toLowerCase()))
      .limit(1)
      .then((rows) => rows[0]);

    if (!oldTag) return null;

    // Check if target name already exists
    const existingTag = await tx
      .select()
      .from(tags)
      .where(eq(sql`lower(${tags.name})`, cleanedNew.toLowerCase()))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingTag) {
      // Merge: update all recipe_tags to point to existing tag, delete old tag
      await tx
        .update(recipeTags)
        .set({ tagId: existingTag.id, version: sql`${recipeTags.version} + 1` })
        .where(eq(recipeTags.tagId, oldTag.id));

      await tx.delete(tags).where(eq(tags.id, oldTag.id));

      return { merged: true, newName: existingTag.name };
    } else {
      // Simple rename
      await tx
        .update(tags)
        .set({ name: cleanedNew, version: sql`${tags.version} + 1` })
        .where(eq(tags.id, oldTag.id));

      return { merged: false, newName: cleanedNew };
    }
  });
}

/**
 * Remove a tag from a specific recipe (not globally).
 */
export async function removeTagFromRecipe(recipeId: string, tagName: string): Promise<boolean> {
  const cleaned = stripHtmlTags(tagName);

  const tag = await findTagByName(cleaned);

  if (!tag) return false;

  const result = await db
    .delete(recipeTags)
    .where(sql`${recipeTags.recipeId} = ${recipeId} AND ${recipeTags.tagId} = ${tag.id}`);

  return (result.rowCount ?? 0) > 0;
}
