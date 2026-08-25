import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import type { CookbookSummaryDTO, EditableCookbookDTO } from "@norish/shared/contracts";
import type { SortOrder } from "@norish/shared/contracts/store-types";
import { db } from "@norish/db/drizzle";

import type { MutationOutcome } from "./mutation-outcomes";
import type { RecipeListContext } from "./recipes";
import { cookbookRecipes, cookbooks, recipes } from "../schema";
import { CookbookSummarySchema } from "../zodSchemas";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { buildOwnerPolicyCondition, PRIMARY_IMAGE_SQL } from "./recipes";

/** How many member images the derived cover mosaic asks for. */
const COVER_TILE_COUNT = 4;

type CookbookRow = {
  id: string;
  userId: string | null;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

const COOKBOOK_COLUMNS = {
  id: cookbooks.id,
  userId: cookbooks.userId,
  title: cookbooks.title,
  createdAt: cookbooks.createdAt,
  updatedAt: cookbooks.updatedAt,
  version: cookbooks.version,
} as const;

/** The four sorts both kinds of Library row can answer. */
export function cookbookOrderBy(sortMode: SortOrder) {
  switch (sortMode) {
    case "titleAsc":
      return asc(cookbooks.title);
    case "titleDesc":
      return desc(cookbooks.title);
    case "dateAsc":
      return asc(cookbooks.createdAt);
    case "none":
      return undefined;
    default:
      return desc(cookbooks.createdAt);
  }
}

/**
 * A cookbook title matches on its title alone — a cookbook has nothing else
 * to offer a search, which is why it can never be found by its members'
 * names (ADR-0026). Plain prefix matching rather than a tsvector: one short
 * field, and a rank that could not be compared with a recipe's anyway.
 */
export function cookbookTitleMatch(search: string) {
  const terms = search
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);

  if (terms.length === 0) return undefined;

  const patterns = terms.map(
    (term) => `%${term.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`
  );

  return sql.join(
    patterns.map((pattern) => sql`${cookbooks.title} ILIKE ${pattern}`),
    sql` OR `
  );
}

/**
 * The viewer-scoped read model each card needs: how many members this reader
 * can see, and the first few of their primary images for the derived cover.
 *
 * One membership join under the same view-policy condition the recipe list
 * applies, so the count and the list agree by construction and two readers
 * may honestly see two different counts (ADR-0027). Images resolve through
 * the same gallery-first SQL recipes use, so the deprecated scalar is never
 * read directly. Ordered by the member's own creation time so the mosaic is
 * stable between reads.
 */
async function memberSummaries(
  ctx: RecipeListContext,
  cookbookIds: string[]
): Promise<Map<string, { memberCount: number; coverImages: string[] }>> {
  const summaries = new Map<string, { memberCount: number; coverImages: string[] }>();

  if (cookbookIds.length === 0) return summaries;

  const policyCondition = await buildOwnerPolicyCondition(ctx, recipes.userId, "view");
  const membership = inArray(cookbookRecipes.cookbookId, cookbookIds);

  const rows = await db
    .select({
      cookbookId: cookbookRecipes.cookbookId,
      image: PRIMARY_IMAGE_SQL,
    })
    .from(cookbookRecipes)
    .innerJoin(recipes, eq(cookbookRecipes.recipeId, recipes.id))
    .where(policyCondition ? and(membership, policyCondition) : membership)
    .orderBy(asc(recipes.createdAt), asc(recipes.id));

  for (const row of rows) {
    const entry = summaries.get(row.cookbookId) ?? { memberCount: 0, coverImages: [] };

    entry.memberCount += 1;

    if (row.image && entry.coverImages.length < COVER_TILE_COUNT) {
      entry.coverImages.push(row.image);
    }

    summaries.set(row.cookbookId, entry);
  }

  return summaries;
}

function toCookbookSummary(
  row: CookbookRow,
  members: { memberCount: number; coverImages: string[] } | undefined
): CookbookSummaryDTO {
  const parsed = CookbookSummarySchema.safeParse({
    ...row,
    memberCount: members?.memberCount ?? 0,
    coverImages: members?.coverImages ?? [],
  });

  if (!parsed.success) throw new Error("CookbookSummaryDTO parse failed");

  return parsed.data;
}

export async function withMemberSummaries(
  ctx: RecipeListContext,
  rows: CookbookRow[]
): Promise<CookbookSummaryDTO[]> {
  const members = await memberSummaries(
    ctx,
    rows.map((row) => row.id)
  );

  return rows.map((row) => toCookbookSummary(row, members.get(row.id)));
}

/**
 * The cookbook's owner, or `null` when it is Orphaned — distinguished from a
 * cookbook that is not there at all, which returns `null` for the whole row.
 */
export async function getCookbookRow(id: string): Promise<CookbookRow | null> {
  const [row] = await db
    .select(COOKBOOK_COLUMNS)
    .from(cookbooks)
    .where(eq(cookbooks.id, id))
    .limit(1);

  return row ?? null;
}

/** One cookbook, as its own page reads it, or null when out of view. */
export async function getCookbookForViewer(
  ctx: RecipeListContext,
  id: string
): Promise<CookbookSummaryDTO | null> {
  const policyCondition = await buildOwnerPolicyCondition(ctx, cookbooks.userId, "view");
  const [row] = await db
    .select(COOKBOOK_COLUMNS)
    .from(cookbooks)
    .where(policyCondition ? and(eq(cookbooks.id, id), policyCondition) : eq(cookbooks.id, id))
    .limit(1);

  if (!row) return null;

  const [summary] = await withMemberSummaries(ctx, [row]);

  return summary ?? null;
}

export async function createCookbook(input: {
  id?: string;
  userId: string;
  title: string;
}): Promise<CookbookSummaryDTO> {
  const [row] = await db
    .insert(cookbooks)
    .values({ ...(input.id ? { id: input.id } : {}), userId: input.userId, title: input.title })
    .returning(COOKBOOK_COLUMNS);

  if (!row) throw new Error("Failed to create cookbook");

  return toCookbookSummary(row, undefined);
}

export async function renameCookbook(
  id: string,
  title: string,
  version: number
): Promise<MutationOutcome<CookbookRow>> {
  const [row] = await db
    .update(cookbooks)
    .set({ title, updatedAt: new Date(), version: sql`${cookbooks.version} + 1` })
    .where(and(eq(cookbooks.id, id), eq(cookbooks.version, version)))
    .returning(COOKBOOK_COLUMNS);

  if (!row) return staleOutcome();

  return appliedOutcome(row);
}

/**
 * Delete a cookbook. Its members' rows go with it through the membership
 * cascade; the recipes themselves are never touched.
 */
export async function deleteCookbookById(
  id: string,
  version?: number
): Promise<MutationOutcome<void>> {
  const conditions = [eq(cookbooks.id, id)];

  if (version) conditions.push(eq(cookbooks.version, version));

  const deleted = await db
    .delete(cookbooks)
    .where(and(...conditions))
    .returning({ id: cookbooks.id });

  if (deleted.length === 0 && version) return staleOutcome();

  return appliedOutcome(undefined);
}

/** Every cookbook this reader may see, under the active sort. */
export async function listCookbooks(
  ctx: RecipeListContext,
  {
    limit,
    offset = 0,
    search,
    sortMode = "dateDesc",
  }: { limit: number; offset?: number; search?: string; sortMode?: SortOrder }
): Promise<{ cookbooks: CookbookSummaryDTO[]; total: number }> {
  const conditions: SQL[] = [];
  const policyCondition = await buildOwnerPolicyCondition(ctx, cookbooks.userId, "view");

  if (policyCondition) conditions.push(policyCondition);

  if (search) {
    const titleMatch = cookbookTitleMatch(search);

    if (titleMatch) conditions.push(sql`(${titleMatch})`);
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const orderBy = cookbookOrderBy(sortMode);

  const [rows, totals] = await Promise.all([
    orderBy
      ? db
          .select(COOKBOOK_COLUMNS)
          .from(cookbooks)
          .where(whereClause)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset)
      : db.select(COOKBOOK_COLUMNS).from(cookbooks).where(whereClause).limit(limit).offset(offset),
    db.select({ total: count() }).from(cookbooks).where(whereClause),
  ]);

  return {
    cookbooks: await withMemberSummaries(ctx, rows),
    total: Number(totals[0]?.total ?? 0),
  };
}

/** A known set of cookbooks, in the order the caller asked for them. */
export async function listCookbooksByIds(
  ctx: RecipeListContext,
  ids: string[]
): Promise<CookbookSummaryDTO[]> {
  if (ids.length === 0) return [];

  const policyCondition = await buildOwnerPolicyCondition(ctx, cookbooks.userId, "view");
  const idCondition = inArray(cookbooks.id, ids);

  const rows = await db
    .select(COOKBOOK_COLUMNS)
    .from(cookbooks)
    .where(policyCondition ? and(idCondition, policyCondition) : idCondition);

  const summaries = await withMemberSummaries(ctx, rows);
  const byId = new Map(summaries.map((summary) => [summary.id, summary]));

  return ids.flatMap((id) => {
    const summary = byId.get(id);

    return summary ? [summary] : [];
  });
}

/** The cookbooks holding a recipe, as its own page lists them. */
export async function listCookbooksForRecipe(
  ctx: RecipeListContext,
  recipeId: string
): Promise<CookbookSummaryDTO[]> {
  const policyCondition = await buildOwnerPolicyCondition(ctx, cookbooks.userId, "view");
  const membership = eq(cookbookRecipes.recipeId, recipeId);

  const rows = await db
    .select(COOKBOOK_COLUMNS)
    .from(cookbookRecipes)
    .innerJoin(cookbooks, eq(cookbookRecipes.cookbookId, cookbooks.id))
    .where(policyCondition ? and(membership, policyCondition) : membership)
    .orderBy(asc(cookbooks.title));

  return withMemberSummaries(ctx, rows);
}

/**
 * The cookbooks this reader may edit, each saying whether it already holds
 * this recipe — the membership panel's whole list, in one read.
 */
export async function listEditableCookbooksForRecipe(
  ctx: RecipeListContext,
  recipeId: string
): Promise<EditableCookbookDTO[]> {
  const policyCondition = await buildOwnerPolicyCondition(ctx, cookbooks.userId, "edit");

  const rows = await db
    .select({
      ...COOKBOOK_COLUMNS,
      // The outer reference is spelled `"cookbooks"."id"` by hand: drizzle
      // renders an interpolated column unqualified in a plain select, and
      // inside this subquery an unqualified `"id"` resolves to the membership
      // table's own column — silently matching nothing.
      containsRecipe: sql<boolean>`EXISTS (
        SELECT 1 FROM ${cookbookRecipes} AS membership
        WHERE membership.cookbook_id = "cookbooks"."id"
          AND membership.recipe_id = ${recipeId}
      )`,
    })
    .from(cookbooks)
    .where(policyCondition)
    .orderBy(asc(cookbooks.title));

  const summaries = await withMemberSummaries(
    ctx,
    rows.map(({ containsRecipe: _containsRecipe, ...row }) => row)
  );

  return summaries.map((summary, index) => ({
    ...summary,
    containsRecipe: Boolean(rows[index]?.containsRecipe),
  }));
}

/**
 * File a recipe into a cookbook. Idempotent by the unique pair, so a double
 * tap changes nothing, and the recipe row is never written (ADR-0027).
 */
export async function addRecipeToCookbook(cookbookId: string, recipeId: string): Promise<void> {
  await db.insert(cookbookRecipes).values({ cookbookId, recipeId }).onConflictDoNothing();
}

/** Take a recipe out of a cookbook. Removing what is not there is a no-op. */
export async function removeRecipeFromCookbook(
  cookbookId: string,
  recipeId: string
): Promise<void> {
  await db
    .delete(cookbookRecipes)
    .where(and(eq(cookbookRecipes.cookbookId, cookbookId), eq(cookbookRecipes.recipeId, recipeId)));
}

/** Which of these recipes this cookbook holds — the membership toggles. */
export async function listCookbookMemberIds(cookbookId: string): Promise<string[]> {
  const rows = await db
    .select({ recipeId: cookbookRecipes.recipeId })
    .from(cookbookRecipes)
    .where(eq(cookbookRecipes.cookbookId, cookbookId));

  return rows.map((row) => row.recipeId);
}

/** Total cookbook rows, for the admin overview's counters. */
export async function getTotalCookbookCount(): Promise<number> {
  const rows = await db.select({ total: count() }).from(cookbooks);

  return Number(rows[0]?.total ?? 0);
}

export type { CookbookRow };
export const CookbookSummaryArraySchema = z.array(CookbookSummarySchema);
