import type { TagDto } from "@/types/dto/tag";

import { eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import { db } from "@/server/db/drizzle";
import { recipeTags, tags } from "@/server/db/schema";
import { TagSelectBaseSchema } from "@/server/db/zodSchemas";
import { stripHtmlTags } from "@/lib/helpers";

const TagArraySchema = z.array(TagSelectBaseSchema);

export async function listAllTagNames(): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(tags)
    .orderBy(sql`lower(${tags.name})`);

  return Array.from(new Set(rows.map((r) => r.name).filter(Boolean)));
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
  tagIds: string[]
): Promise<void> {
  if (!tagIds.length) return;

  const rows = tagIds.map((tagId: string) => ({ recipeId, tagId }));

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
  const ids = created.map((t) => t.id);

  await attachTagsToRecipeTx(tx, recipeId, ids);
}

export async function getRecipeTagNames(recipeId: string): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(recipeTags)
    .innerJoin(tags, eq(recipeTags.tagId, tags.id))
    .where(eq(recipeTags.recipeId, recipeId));

  return rows.map((r) => r.name);
}
