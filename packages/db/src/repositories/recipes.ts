import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, ilike, inArray, isNull, like, lte, or, sql } from "drizzle-orm";
import z from "zod";

import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";
import type {
  FullRecipeDTO,
  FullRecipeInsertDTO,
  FullRecipeUpdateDTO,
  MeasurementSystem,
  RecipeCategory,
  RecipeDashboardDTO,
} from "@norish/shared/contracts/dto/recipe";
import type {
  RecipeIngredientInsertDto,
  RecipeIngredientsDto,
} from "@norish/shared/contracts/dto/recipe-ingredient";
import type { StepDto, StepInsertDto } from "@norish/shared/contracts/dto/steps";
import type { FilterMode, SearchField, SortOrder } from "@norish/shared/contracts/store-types";
import {
  DEFAULT_RECIPE_PERMISSION_POLICY,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";
import { db } from "@norish/db/drizzle";
import { dbLogger } from "@norish/db/logger";
import { stripHtmlTags } from "@norish/shared/lib/helpers";
import { normalizeOriginCountry } from "@norish/shared/lib/recipe-enrichment";
import { normalizeUnit } from "@norish/shared/lib/unit-localization";

import type { MutationOutcome } from "./mutation-outcomes";
import {
  cookbookRecipes,
  householdUsers,
  ingredients,
  recipeFavorites,
  recipeImages,
  recipeIngredients,
  recipes,
  recipeTags,
  recipeVideos,
  stepImages,
  steps as stepsTable,
  tags,
} from "../schema";
import {
  FullRecipeInsertSchema,
  FullRecipeSchema,
  FullRecipeUpdateSchema,
  RecipeDashboardSchema,
} from "../zodSchemas";
import { replaceRecipeCuisinesTx } from "./cuisines";
import {
  attachIngredientsToRecipeByInputTx,
  getOrCreateManyIngredientsTx,
  getUnitsForNormalization,
} from "./ingredients";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { getConfig } from "./server-config";
import {
  createManyRecipeStepsTx,
  loadIngredientLineIdsByOrderTx,
  syncStepIngredientsTx,
} from "./steps";
import { attachTagsToRecipeByInputTx } from "./tags";

type RecipeViewPolicy = RecipePermissionPolicy["view"];

/**
 * Which of the recipe permission policy's three levels a query is asking
 * about. Spelled out here rather than imported from `@norish/auth`, which
 * depends on this package.
 */
export type PolicyAction = "view" | "edit" | "delete";

async function getRecipePolicyLevel(action: PolicyAction): Promise<RecipeViewPolicy> {
  const policy = await getConfig<RecipePermissionPolicy>(ServerConfigKeys.RECIPE_PERMISSION_POLICY);

  return policy?.[action] ?? DEFAULT_RECIPE_PERMISSION_POLICY[action];
}

function nonEmpty(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

export async function GetTotalRecipeCount(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(recipes);

  return Number(result?.[0]?.count ?? 0);
}

export async function deleteRecipeById(
  id: string,
  version?: number
): Promise<MutationOutcome<void>> {
  const whereConditions = [eq(recipes.id, id)];

  if (version) {
    whereConditions.push(eq(recipes.version, version));
  }

  const deleted = await db
    .delete(recipes)
    .where(and(...whereConditions))
    .returning({ id: recipes.id });

  if (deleted.length === 0 && version) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

/**
 * Get the owner userId for a recipe (for permission checks)
 */
export async function getRecipeOwnerId(recipeId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: recipes.userId })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  return row?.userId ?? null;
}

export async function getRecipeByUrl(url: string): Promise<FullRecipeDTO | null> {
  const rows = await db.query.recipes.findFirst({
    where: eq(recipes.url, url),
    columns: { id: true },
  });

  if (!rows) return null;
  const recipe = await getRecipeFull(rows.id);

  return FullRecipeSchema.parse(recipe);
}

/**
 * Check if recipe URL exists based on view policy.
 * Used for queue deduplication before creating new recipes.
 *
 * - "everyone": Any recipe with this URL
 * - "household": Any recipe with this URL owned by household members
 * - "owner": Any recipe with this URL owned by the user
 */
export async function recipeExistsByUrlForPolicy(
  url: string,
  userId: string,
  householdUserIds: string[] | null,
  viewPolicy: "everyone" | "household" | "owner"
): Promise<{ exists: boolean; existingRecipeId?: string }> {
  let whereCondition: ReturnType<typeof and> | ReturnType<typeof or> | ReturnType<typeof eq>;

  switch (viewPolicy) {
    case "everyone":
      // Check if URL exists at all
      whereCondition = eq(recipes.url, url);
      break;

    case "household":
      // Check if URL exists for any household member
      if (householdUserIds && householdUserIds.length > 0) {
        const userIds = householdUserIds.includes(userId)
          ? householdUserIds
          : [...householdUserIds, userId];

        whereCondition = and(eq(recipes.url, url), inArray(recipes.userId, userIds));
      } else {
        whereCondition = and(eq(recipes.url, url), eq(recipes.userId, userId));
      }
      break;

    case "owner":
      // Check if URL exists for this specific user
      whereCondition = and(eq(recipes.url, url), eq(recipes.userId, userId));
      break;

    default:
      whereCondition = and(eq(recipes.url, url), eq(recipes.userId, userId));
  }

  const existing = await db.query.recipes.findFirst({
    where: whereCondition,
    columns: { id: true },
  });

  if (existing) {
    dbLogger.debug(
      { url, recipeId: existing.id, viewPolicy },
      "Found existing recipe by URL for policy"
    );
  }

  return { exists: existing !== null, existingRecipeId: existing?.id };
}

/**
 * Check if a recipe already exists within a household context.
 * First checks by URL (if provided), then falls back to exact title match.
 * Returns the existing recipe ID if found, null otherwise.
 */
export async function findExistingRecipe(
  userIds: string[],
  url: string | null | undefined,
  title: string
): Promise<string | null> {
  // First try to find by URL if provided (most reliable)
  if (url && url.trim()) {
    const byUrl = await db.query.recipes.findFirst({
      where: and(inArray(recipes.userId, userIds), eq(recipes.url, url.trim())),
      columns: { id: true },
    });

    if (byUrl) {
      dbLogger.debug({ url, recipeId: byUrl.id }, "Found existing recipe by URL");

      return byUrl.id;
    }
  }

  // Fall back to exact title match (case-insensitive)
  const trimmedTitle = title.trim();

  if (trimmedTitle) {
    const byTitle = await db.query.recipes.findFirst({
      where: and(inArray(recipes.userId, userIds), ilike(recipes.name, trimmedTitle)),
      columns: { id: true },
    });

    if (byTitle) {
      dbLogger.debug(
        { title: trimmedTitle, recipeId: byTitle.id },
        "Found existing recipe by title"
      );

      return byTitle.id;
    }
  }

  return null;
}

export interface RecipeListContext {
  userId: string;
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
}

/**
 * Build the SQL condition the recipe permission policy puts on an owner
 * column, for whichever of its three levels the caller is asking about.
 *
 * A row with a null owner — an Orphaned recipe, or an Orphaned cookbook — is
 * always included, at every level and for every action, which is the same
 * answer `assertRecipeAccess` gives one row at a time.
 *
 * The owner column is a parameter because cookbooks answer to this same
 * policy rather than a rule of their own (ADR-0027): a cookbook is exactly as
 * visible as the recipes its owner could see, so the two conditions have to
 * come from one place or they will drift.
 */
export async function buildOwnerPolicyCondition(
  ctx: RecipeListContext,
  ownerColumn: AnyPgColumn,
  action: PolicyAction = "view"
) {
  const level = await getRecipePolicyLevel(action);

  // Server admin sees all
  if (ctx.isServerAdmin) {
    return undefined;
  }

  const ownOrOrphaned = () => or(eq(ownerColumn, ctx.userId), sql`${ownerColumn} IS NULL`);

  switch (level) {
    case "everyone":
      // No filtering needed
      return undefined;

    case "household":
      // Own rows + household members' rows + orphaned rows (null owner)
      if (ctx.householdUserIds && ctx.householdUserIds.length > 0) {
        // Ensure user's own ID is included (should always be, but safety check)
        const userIds = ctx.householdUserIds.includes(ctx.userId)
          ? ctx.householdUserIds
          : [...ctx.householdUserIds, ctx.userId];

        return or(inArray(ownerColumn, userIds), sql`${ownerColumn} IS NULL`);
      }

      // No household = only own rows + orphaned rows
      return ownOrOrphaned();

    case "owner":
      // Only own rows + orphaned rows (null owner)
      return ownOrOrphaned();

    default:
      return ownOrOrphaned();
  }
}

/**
 * The recipe list's own view-policy condition — `buildOwnerPolicyCondition`
 * pointed at `recipes.userId`.
 */
async function buildViewPolicyCondition(ctx: RecipeListContext) {
  return buildOwnerPolicyCondition(ctx, recipes.userId, "view");
}

/**
 * Every recipe id the viewer can see under the deployment's view policy.
 */
export async function listVisibleRecipeIds(ctx: RecipeListContext): Promise<string[]> {
  const policyCondition = await buildViewPolicyCondition(ctx);

  const rows = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(policyCondition)
    .orderBy(asc(recipes.createdAt));

  return rows.map((row) => row.id);
}

/**
 * SQL twin of `primaryRecipeImage` (@norish/shared/lib/recipe-media): the
 * first gallery image by order, falling back to the legacy `recipes.image`
 * scalar. Every list-shaped projection serves its `image` through this, so
 * nothing reads the deprecated scalar directly; a change here must move
 * with the shared helper.
 *
 * The outer references are spelled `"recipes"."id"`/`"recipes"."image"` by
 * hand: interpolating the drizzle columns renders them unqualified in plain
 * selects, and inside the subquery an unqualified `"id"` resolves to the
 * gallery's own column — silently matching nothing.
 */
export const PRIMARY_IMAGE_SQL = sql<string | null>`COALESCE(
  (SELECT gallery.image FROM ${recipeImages} AS gallery
    WHERE gallery.recipe_id = "recipes"."id"
    ORDER BY COALESCE(gallery."order", 0) ASC, gallery.created_at ASC
    LIMIT 1),
  "recipes"."image"
)`;

/**
 * The weighted search document and its rank, for whichever fields the reader
 * has chosen.
 *
 * Priority is title (A) > tags (B) > ingredients (C) > description/steps (D),
 * and the terms are prefix-matched so "om" finds "oma". Returns null when
 * there is nothing to search for, either because no term survived
 * sanitisation or because the reader unticked every field.
 *
 * Every reference is spelled `"recipes"."…"` by hand for the same reason
 * PRIMARY_IMAGE_SQL is: an interpolated drizzle column renders unqualified,
 * which resolves to the wrong table inside a correlated subquery and silently
 * matches nothing. The explicit spelling is what lets one builder serve both
 * the recipe list and the Library union.
 */
export function recipeSearchSql(
  search: string | undefined,
  searchFields: SearchField[]
): { match: ReturnType<typeof sql>; rank: ReturnType<typeof sql<number>> } | null {
  if (!search || searchFields.length === 0) return null;

  // Sanitize terms to remove PostgreSQL tsquery special characters.
  const sanitizeTsqueryTerm = (term: string): string => term.replace(/[&|!():<>*\\'"]/g, "").trim();

  const searchTerms = search
    .trim()
    .split(/\s+/)
    .map(sanitizeTsqueryTerm)
    .filter((term) => term.length > 0)
    .map((term) => `${term}:*`)
    .join(" | ");

  if (!searchTerms) return null;

  const parts: ReturnType<typeof sql>[] = [];

  for (const field of searchFields) {
    switch (field) {
      case "title":
        parts.push(sql`setweight(to_tsvector('simple', coalesce("recipes"."name", '')), 'A')`);
        break;
      case "tags":
        parts.push(
          sql`setweight(to_tsvector('simple', coalesce((
            SELECT string_agg(search_tag.name, ' ')
            FROM ${recipeTags} search_rt
            INNER JOIN ${tags} search_tag ON search_rt.tag_id = search_tag.id
            WHERE search_rt.recipe_id = "recipes"."id"
          ), '')), 'B')`
        );
        break;
      case "ingredients":
        parts.push(
          sql`setweight(to_tsvector('simple', coalesce((
            SELECT string_agg(search_ingredient.name, ' ')
            FROM ${recipeIngredients} search_ri
            INNER JOIN ${ingredients} search_ingredient ON search_ri.ingredient_id = search_ingredient.id
            WHERE search_ri.recipe_id = "recipes"."id"
          ), '')), 'C')`
        );
        break;
      case "description":
        parts.push(
          sql`setweight(to_tsvector('simple', coalesce("recipes"."description", '')), 'D')`
        );
        break;
      case "steps":
        parts.push(
          sql`setweight(to_tsvector('simple', coalesce((
            SELECT string_agg(search_step.step, ' ')
            FROM ${stepsTable} search_step
            WHERE search_step.recipe_id = "recipes"."id"
          ), '')), 'D')`
        );
        break;
    }
  }

  if (parts.length === 0) return null;

  const document = sql.join(parts, sql` || `);
  const query = sql`to_tsquery('simple', ${searchTerms})`;

  return {
    match: sql`(${document}) @@ ${query}`,
    rank: sql<number>`ts_rank(${document}, ${query})`,
  };
}

/**
 * The dashboard projection, in one place.
 *
 * Three reads answer in this shape — the recipe list, one recipe by id, and a
 * known set of ids for the Library union — and a field added to
 * RecipeDashboardSchema has to reach all three or the cards disagree.
 */
const DASHBOARD_COLUMNS = {
  id: true,
  userId: true,
  name: true,
  description: true,
  notes: true,
  url: true,
  servings: true,
  prepMinutes: true,
  cookMinutes: true,
  totalMinutes: true,
  calories: true,
  // Only the country: the dashboard flies its flag, and the rest of the
  // provenance group has nothing to show at that size.
  originCountry: true,
  categories: true,
  createdAt: true,
  updatedAt: true,
  version: true,
} as const;

const DASHBOARD_WITH = {
  recipeTags: {
    with: { tag: { columns: { id: true, name: true, version: true } } },
    /**
     * Tag order is the editor's, so the cards read the same way the recipe
     * does. A getter, not a value: reading a schema column while this module
     * is still loading breaks any consumer that mocks `@norish/db/schema`,
     * and it is only ever needed when a query is actually built.
     */
    get orderBy() {
      return [asc(recipeTags.order)];
    },
  },
  ratings: { columns: { rating: true } },
} as const;

type DashboardRow = {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  notes: string | null;
  url: string | null;
  image: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  calories: number | null;
  originCountry: string | null;
  categories: RecipeCategory[] | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  recipeTags?: { tag?: { name?: string; version?: number } | null }[];
  ratings?: { rating: number }[];
};

/** One projected row as the cards read it, ratings averaged. */
function toDashboardRecipe(r: DashboardRow) {
  const ratingValues = (r.ratings ?? []).map((rating) => rating.rating);
  const ratingCount = ratingValues.length;

  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    description: r.description ?? null,
    notes: r.notes ?? null,
    url: r.url ?? null,
    image: r.image ?? null,
    servings: r.servings ?? 1,
    prepMinutes: r.prepMinutes ?? null,
    cookMinutes: r.cookMinutes ?? null,
    totalMinutes: r.totalMinutes ?? null,
    calories: r.calories ?? null,
    originCountry: r.originCountry ?? null,
    categories: r.categories ?? [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    version: r.version,
    tags: (r.recipeTags ?? []).flatMap((rt) =>
      rt.tag && typeof rt.tag.name === "string" && typeof rt.tag.version === "number"
        ? [{ name: rt.tag.name, version: rt.tag.version }]
        : []
    ),
    averageRating:
      ratingCount > 0 ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingCount : null,
    ratingCount,
  };
}

export async function listRecipes(
  ctx: RecipeListContext,
  limit: number,
  offset: number = 0,
  search?: string,
  searchFields: SearchField[] = ["title", "ingredients"],
  tagNames?: string[],
  filterMode: FilterMode = "OR",
  sortMode: SortOrder = "dateDesc",
  minRating?: number,
  maxCookingTime?: number,
  categories?: RecipeCategory[],
  /**
   * Narrow the list to one cookbook's members. The rest of this function is
   * untouched by it, so a cookbook's page gets the reader's own sort, search
   * and filters for free — and the members answer the same view policy the
   * Library applies, which is what makes a cookbook's count and its list
   * agree by construction (ADR-0027).
   */
  options?: { cookbookId?: string; favoritesOnly?: boolean }
): Promise<{ recipes: RecipeDashboardDTO[]; total: number }> {
  const whereConditions: any[] = [];

  // Apply view policy filtering
  const policyCondition = await buildViewPolicyCondition(ctx);

  if (policyCondition) {
    whereConditions.push(policyCondition);
  }

  if (options?.favoritesOnly) {
    // Same clause the Library union applies, so the favourites toggle means
    // the same thing inside a cookbook as it does on the Library.
    whereConditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${recipeFavorites} AS favorite
        WHERE favorite.recipe_id = "recipes"."id" AND favorite.user_id = ${ctx.userId}
      )`
    );
  }

  if (options?.cookbookId) {
    // `"recipes"."id"` by hand: drizzle renders an interpolated column
    // unqualified, and inside this subquery an unqualified `"id"` would
    // resolve to the membership table's own column.
    whereConditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${cookbookRecipes} AS membership
        WHERE membership.cookbook_id = ${options.cookbookId}
          AND membership.recipe_id = "recipes"."id"
      )`
    );
  }

  // Build full-text search with weighted ranking, through the one builder
  // the Library union uses too.
  const searchSql = recipeSearchSql(search, searchFields);
  let searchRank: ReturnType<typeof sql<number>> | null = null;

  if (searchSql) {
    whereConditions.push(searchSql.match);
    searchRank = searchSql.rank;
  }

  let tagFilteredIds: string[] | undefined;

  if (tagNames?.length) {
    const normalizedTags = tagNames.map((t) => t.toLowerCase());
    const tagRelations = await db.query.recipeTags.findMany({
      columns: { recipeId: true },
      with: { tag: { columns: { name: true } } },
    });

    const recipeTagMap = new Map<string, Set<string>>();

    for (const rel of tagRelations) {
      const tagName = rel.tag?.name?.toLowerCase();

      if (!tagName) continue;
      if (!recipeTagMap.has(rel.recipeId)) {
        recipeTagMap.set(rel.recipeId, new Set());
      }
      recipeTagMap.get(rel.recipeId)!.add(tagName);
    }

    tagFilteredIds = Array.from(recipeTagMap.entries())
      .filter(([_, tagSet]) =>
        filterMode === "AND"
          ? normalizedTags.every((t) => tagSet.has(t))
          : normalizedTags.some((t) => tagSet.has(t))
      )
      .map(([recipeId]) => recipeId);

    if (!tagFilteredIds.length) {
      return { recipes: [], total: 0 };
    }

    whereConditions.push(inArray(recipes.id, tagFilteredIds));
  }

  if (categories?.length) {
    const categoryArray = `{${categories.join(",")}}`;

    whereConditions.push(sql`${recipes.categories} && ${categoryArray}::recipe_category[]`);
  }

  if (maxCookingTime !== undefined) {
    const hasTime = sql`(${recipes.totalMinutes} IS NOT NULL OR ${recipes.prepMinutes} IS NOT NULL OR ${recipes.cookMinutes} IS NOT NULL)`;
    const effectiveMinutes = sql<number>`CASE WHEN ${recipes.totalMinutes} IS NOT NULL THEN ${recipes.totalMinutes} ELSE COALESCE(${recipes.prepMinutes}, 0) + COALESCE(${recipes.cookMinutes}, 0) END`;

    whereConditions.push(and(hasTime, lte(effectiveMinutes, maxCookingTime)));
  }

  const whereClause = whereConditions.length ? and(...whereConditions) : undefined;

  const sortMap = {
    titleAsc: asc(recipes.name),
    titleDesc: desc(recipes.name),
    dateAsc: asc(recipes.createdAt),
    dateDesc: desc(recipes.createdAt),
    none: undefined,
  };
  const baseOrderBy = sortMap[sortMode as keyof typeof sortMap] ?? desc(recipes.createdAt);

  // When searching, order by relevance rank first (descending), then by the selected sort
  const orderBy = searchRank
    ? baseOrderBy
      ? [desc(searchRank), baseOrderBy]
      : desc(searchRank)
    : baseOrderBy;

  const [rows, totalCount] = await Promise.all([
    db.query.recipes.findMany({
      columns: DASHBOARD_COLUMNS,
      extras: {
        // The resolved primary, not the deprecated scalar.
        image: PRIMARY_IMAGE_SQL.as("image"),
      },
      with: DASHBOARD_WITH,
      where: whereClause,
      orderBy,
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(recipes)
      .where(whereClause),
  ]);

  const parsed = z.array(RecipeDashboardSchema).safeParse(rows.map(toDashboardRecipe));

  if (!parsed.success) throw new Error("RecipeDashboardDTO parse failed");

  // Filter by minimum rating if specified (post-fetch since rating is computed)
  let filteredRecipes = parsed.data;

  if (minRating !== undefined) {
    filteredRecipes = parsed.data.filter(
      (r) => r.averageRating != null && r.averageRating >= minRating
    );
  }

  return {
    recipes: filteredRecipes,
    total: minRating !== undefined ? filteredRecipes.length : Number(totalCount?.[0]?.count ?? 0),
  };
}

/**
 * The dashboard projection for a known set of ids, in the order the caller
 * asked for them.
 *
 * The Library union decides the order in SQL and then hydrates, so this is
 * how a page of mixed rows gets its recipe halves without the union having to
 * carry every card field through it.
 */
/**
 * The dashboard projection for a known set of ids, in the order the caller
 * asked for them.
 *
 * The Library union decides the order in SQL and then hydrates, so this is
 * how a page of mixed rows gets its recipe halves without the union having to
 * carry every card field through it.
 */
export async function listDashboardRecipesByIds(ids: string[]): Promise<RecipeDashboardDTO[]> {
  if (ids.length === 0) return [];

  const rows = await db.query.recipes.findMany({
    where: inArray(recipes.id, ids),
    columns: DASHBOARD_COLUMNS,
    extras: { image: PRIMARY_IMAGE_SQL.as("image") },
    with: DASHBOARD_WITH,
  });

  const parsed = z.array(RecipeDashboardSchema).safeParse(rows.map(toDashboardRecipe));

  if (!parsed.success) throw new Error("RecipeDashboardDTO parse failed");

  const byId = new Map(parsed.data.map((recipe) => [recipe.id, recipe]));

  return ids.flatMap((id) => {
    const recipe = byId.get(id);

    return recipe ? [recipe] : [];
  });
}

export async function dashboardRecipe(id: string): Promise<RecipeDashboardDTO | null> {
  const rows = await db.query.recipes.findMany({
    where: eq(recipes.id, id),
    columns: DASHBOARD_COLUMNS,
    extras: {
      // The resolved primary, not the deprecated scalar.
      image: PRIMARY_IMAGE_SQL.as("image"),
    },
    with: {
      recipeTags: {
        columns: {},
        with: {
          tag: { columns: { id: true, name: true, version: true } },
        },
        orderBy: (rt, { asc }) => [asc(rt.order)],
      },
      ratings: {
        columns: { rating: true },
      },
    },
    limit: 1,
  });

  if (rows.length === 0) return null;
  const r = rows[0];

  if (!r) return null;

  // Compute average rating
  const ratingValues = (r.ratings ?? []).map((rating) => rating.rating);
  const ratingCount = ratingValues.length;
  const averageRating =
    ratingCount > 0 ? ratingValues.reduce((sum, val) => sum + val, 0) / ratingCount : null;

  const dto = {
    id: r.id,
    userId: r.userId,
    name: r.name,
    description: r.description ?? null,
    notes: r.notes ?? null,
    url: r.url ?? null,
    image: r.image ?? null,
    servings: r.servings ?? null,
    prepMinutes: r.prepMinutes ?? null,
    cookMinutes: r.cookMinutes ?? null,
    totalMinutes: r.totalMinutes ?? null,
    calories: r.calories ?? null,
    originCountry: r.originCountry ?? null,
    categories: r.categories ?? [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    version: r.version,
    tags: (r.recipeTags ?? [])
      .map((rt: any) => rt.tag)
      .filter((tag: { name?: string; version?: number } | null | undefined) => tag?.name)
      .map((tag: { name: string; version: number }) => ({ name: tag.name, version: tag.version })),
    averageRating,
    ratingCount,
  };

  const parsed = RecipeDashboardSchema.safeParse(dto);

  return parsed.success ? parsed.data : null;
}

/**
 * Outcome of a recipe creation attempt.
 *
 * `inserted` distinguishes a genuinely new recipe from a URL that already
 * resolved to one. Only a new insert becomes a usable recipe for the first
 * time, and only that may enroll Automatic Recipe Enrichment — an ambiguous
 * identifier alone cannot tell the caller which happened.
 */
export type CreateRecipeResult =
  { status: "inserted"; recipeId: string } | { status: "existing"; recipeId: string };

export async function createRecipeWithRefs(
  recipeId: string,
  userId: string | null | undefined,
  input: FullRecipeInsertDTO
): Promise<CreateRecipeResult | null> {
  const parsed = FullRecipeInsertSchema.safeParse(input);

  dbLogger.debug({ parsed }, "Parsed full recipe insert");
  if (!parsed.success) {
    throw new Error("Could not parse recipe data.");
  }

  const payload = parsed.data;

  const toInsert = {
    id: recipeId,
    name: stripHtmlTags(payload.name),
    userId,
    description: payload.description ? stripHtmlTags(payload.description) : null,
    notes: payload.notes ?? null,
    url: payload.url ?? null,
    // The deprecated scalar is never written: a payload image lands in the
    // gallery below.
    image: null,
    dishColor: payload.dishColor ?? null,
    servings: payload.servings ?? 1,
    systemUsed: payload.systemUsed,
    prepMinutes: payload.prepMinutes ?? null,
    cookMinutes: payload.cookMinutes ?? null,
    totalMinutes: payload.totalMinutes ?? null,
    calories: payload.calories ?? null,
    fat: payload.fat ?? null,
    carbs: payload.carbs ?? null,
    protein: payload.protein ?? null,
    originCountry: normalizeOriginCountry(payload.originCountry),
    // The written name is the code's companion: without a code there is no
    // country to name, so a name supplied alone is dropped with it.
    originCountryName:
      normalizeOriginCountry(payload.originCountry) && payload.originCountryName
        ? stripHtmlTags(payload.originCountryName)
        : null,
    originRegion: payload.originRegion ? stripHtmlTags(payload.originRegion) : null,
    provenanceNote: payload.provenanceNote ? stripHtmlTags(payload.provenanceNote) : null,
    categories: payload.categories ?? [],
  };

  const result = await db.transaction(async (tx): Promise<CreateRecipeResult> => {
    const [inserted] = await tx
      .insert(recipes)
      .values(toInsert)
      .onConflictDoNothing({ target: [recipes.url, recipes.userId] })
      .returning({ id: recipes.id });

    if (!inserted) {
      const existing = await tx.query.recipes.findFirst({
        where: and(eq(recipes.url, toInsert.url!), eq(recipes.userId, userId ?? "")),
        columns: { id: true },
      });

      if (!existing) {
        throw new Error("Failed to save recipe");
      }

      return { status: "existing", recipeId: existing.id };
    }

    const rid = inserted.id;

    if (payload.tags.length) {
      await attachTagsToRecipeByInputTx(
        tx,
        rid,
        payload.tags.map((t) => t.name)
      );
    }

    if (payload.cuisines.length) {
      await replaceRecipeCuisinesTx(tx, rid, payload.cuisines);
    }

    if (payload.recipeIngredients.length) {
      await attachIngredientsToRecipeByInputTx(
        tx,
        payload.recipeIngredients.map((ri) => ({
          ...ri,
          recipeId: rid,
          systemUsed: ri.systemUsed ?? payload.systemUsed,
        }))
      );
    }

    if (payload.steps.length) {
      await createManyRecipeStepsTx(
        tx,
        payload.steps.map((s) => ({
          ...s,
          recipeId: rid,
        }))
      );
    }

    // Insert gallery images. The gallery is the source of truth for a
    // recipe's pictures; a legacy scalar in the payload (foreign archive
    // imports, the public API) is translated into it rather than written to
    // the deprecated column — appended after the gallery so it never
    // displaces the primary the payload actually led with.
    const galleryImages = [...(payload.images ?? [])];
    const legacyScalar = (payload.image ?? "").trim();

    if (legacyScalar !== "" && !galleryImages.some((img) => img.image === legacyScalar)) {
      const maxOrder = galleryImages.reduce(
        (max, img) => Math.max(max, Number(img.order ?? 0)),
        -1
      );

      galleryImages.push({ image: legacyScalar, order: maxOrder + 1 });
    }

    if (galleryImages.length > 0) {
      await tx.insert(recipeImages).values(
        galleryImages.map((img) => ({
          recipeId: rid,
          image: img.image,
          order: String(img.order ?? 0),
          generated: img.generated === true,
        }))
      );
    }

    // Insert videos if provided
    if (payload.videos && payload.videos.length > 0) {
      await tx.insert(recipeVideos).values(
        payload.videos.map((v) => ({
          recipeId: rid,
          video: v.video,
          thumbnail: v.thumbnail ?? null,
          duration: v.duration != null ? String(v.duration) : null,
          order: String(v.order ?? 0),
        }))
      );
    }

    return { status: "inserted", recipeId: rid };
  });

  return result;
}

export async function setActiveSystemForRecipe(
  recipeId: string,
  system: MeasurementSystem,
  version?: number
): Promise<MutationOutcome<void>> {
  const whereConditions = [eq(recipes.id, recipeId)];

  if (version) {
    whereConditions.push(eq(recipes.version, version));
  }

  const updated = await db
    .update(recipes)
    .set({ systemUsed: system, version: sql`${recipes.version} + 1` })
    .where(and(...whereConditions))
    .returning({ id: recipes.id });

  if (updated.length === 0 && version) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

export async function updateRecipeCategories(
  recipeId: string,
  categories: RecipeCategory[],
  version?: number
): Promise<MutationOutcome<void>> {
  const whereConditions = [eq(recipes.id, recipeId)];

  if (version) {
    whereConditions.push(eq(recipes.version, version));
  }

  const updated = await db
    .update(recipes)
    .set({ categories, updatedAt: new Date(), version: sql`${recipes.version} + 1` })
    .where(and(...whereConditions))
    .returning({ id: recipes.id });

  if (updated.length === 0 && version) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

/**
 * Every recipe on the server, with the context Recipe Enrichment enrollment
 * needs: the owning user and that user's household. Both are null when the
 * owner's account has been deleted. The schema permits a user in several
 * households; DISTINCT ON keeps one row per recipe, because enrollment needs
 * a household for the recipe, not all of them.
 */
export async function getAllRecipesForEnrichment(): Promise<
  { recipeId: string; userId: string | null; householdId: string | null }[]
> {
  const rows = await db
    .selectDistinctOn([recipes.id], {
      recipeId: recipes.id,
      userId: recipes.userId,
      householdId: householdUsers.householdId,
    })
    .from(recipes)
    .leftJoin(householdUsers, eq(householdUsers.userId, recipes.userId))
    .orderBy(recipes.id);

  return rows;
}

/**
 * How many images an Enrich All Recipes sweep would generate (ADR-0025): the
 * one kind whose cost is per recipe and lands on a bill, so the confirmation
 * names the number before it starts. A per-request read, never stored.
 *
 * Mirrors the coordinator's eligibility exactly: a recipe with no ingredient
 * rows is insufficient input for the kind, and "missing" means no image at
 * all — no gallery row, and a null or blank legacy scalar. Do not loosen
 * either side to make the count easier; the default sweep must stay
 * incapable of touching a stored image.
 */
export async function getImageGenerationSweepCounts(): Promise<{
  /** Recipes the overwrite sweep would draw for: everything with ingredients. */
  eligible: number;
  /** The default sweep's subset: eligible recipes holding no image at all. */
  missingImage: number;
}> {
  const hasIngredients = sql`EXISTS (
    SELECT 1 FROM ${recipeIngredients} WHERE ${recipeIngredients.recipeId} = ${recipes.id}
  )`;
  const hasNoImage = sql`NOT EXISTS (
    SELECT 1 FROM ${recipeImages} WHERE ${recipeImages.recipeId} = ${recipes.id}
  ) AND (${recipes.image} IS NULL OR btrim(${recipes.image}) = '')`;

  const [row] = await db
    .select({
      eligible: sql<number>`COUNT(*) FILTER (WHERE ${hasIngredients})`,
      missingImage: sql<number>`COUNT(*) FILTER (WHERE ${hasIngredients} AND ${hasNoImage})`,
    })
    .from(recipes);

  return {
    eligible: Number(row?.eligible ?? 0),
    missingImage: Number(row?.missingImage ?? 0),
  };
}

export async function getRecipeFull(id: string): Promise<FullRecipeDTO | null> {
  const full = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
    columns: {
      id: true,
      userId: true,
      name: true,
      description: true,
      notes: true,
      url: true,
      image: true,
      dishColor: true,
      servings: true,
      prepMinutes: true,
      cookMinutes: true,
      totalMinutes: true,
      systemUsed: true,
      calories: true,
      fat: true,
      carbs: true,
      protein: true,
      originCountry: true,
      originCountryName: true,
      originRegion: true,
      provenanceNote: true,
      categories: true,
      createdAt: true,
      updatedAt: true,
      version: true,
    },
    with: {
      recipeTags: {
        columns: {},
        with: { tag: { columns: { id: true, name: true, version: true } } },
        orderBy: (rt, { asc }) => [asc(rt.order)],
      },
      recipeCuisines: {
        columns: {},
        with: { cuisine: { columns: { id: true, name: true, version: true } } },
        orderBy: (rc, { asc }) => [asc(rc.order)],
      },
      ingredients: {
        columns: {
          id: true,
          ingredientId: true,
          amount: true,
          unit: true,
          systemUsed: true,
          order: true,
          version: true,
        },
        with: { ingredient: { columns: { name: true } } },
        orderBy: (ingredients, { asc }) => [asc(ingredients.order)],
      },
      steps: {
        columns: { step: true, systemUsed: true, order: true, version: true },
        with: {
          images: {
            columns: { id: true, image: true, order: true, version: true },
            orderBy: (images, { asc }) => [asc(images.order)],
          },
          stepIngredients: {
            columns: { share: true, order: true },
            // The reference resolves by the line's order within the step's
            // system; the join carries just enough to say which line.
            with: { recipeIngredient: { columns: { order: true } } },
            orderBy: (stepIngredients, { asc }) => [asc(stepIngredients.order)],
          },
        },
        orderBy: (steps, { asc }) => [asc(steps.order)],
      },
      images: {
        columns: { id: true, image: true, order: true, generated: true, version: true },
        orderBy: (images, { asc }) => [asc(images.order)],
      },
      videos: {
        columns: {
          id: true,
          video: true,
          thumbnail: true,
          duration: true,
          order: true,
          version: true,
        },
        orderBy: (videos, { asc }) => [asc(videos.order)],
      },
    },
  });

  if (!full) return null;

  // fetch author if exists
  let author:
    { id: string; name: string | null; image: string | null; version: number } | undefined;

  if (full.userId) {
    const { getUserAuthorInfo } = await import("./users");
    const userInfo = await getUserAuthorInfo(full.userId!);

    if (userInfo) {
      author = userInfo;
    }
  }

  const dto = {
    id: full.id,
    userId: full.userId,
    name: full.name,
    description: full.description ?? null,
    notes: full.notes ?? null,
    url: full.url ?? null,
    image: full.image ?? null,
    dishColor: full.dishColor ?? null,
    servings: full.servings ?? 1,
    prepMinutes: full.prepMinutes ?? null,
    cookMinutes: full.cookMinutes ?? null,
    totalMinutes: full.totalMinutes ?? null,
    systemUsed: full.systemUsed,
    calories: full.calories ?? null,
    fat: full.fat ?? null,
    carbs: full.carbs ?? null,
    protein: full.protein ?? null,
    originCountry: full.originCountry ?? null,
    originCountryName: full.originCountryName ?? null,
    originRegion: full.originRegion ?? null,
    provenanceNote: full.provenanceNote ?? null,
    categories: full.categories ?? [],
    steps: (full.steps ?? []).map((s: any) => ({
      step: s.step,
      systemUsed: s.systemUsed,
      order: s.order,
      version: s.version,
      images: (s.images ?? []).map((img: any) => ({
        id: img.id,
        image: img.image,
        order: Number(img.order) || 0,
        version: img.version,
      })),
      stepIngredients: (s.stepIngredients ?? []).flatMap((ref: any) =>
        ref.recipeIngredient
          ? [
              {
                ingredientOrder: Number(ref.recipeIngredient.order) || 0,
                share: Number(ref.share) || 1,
                order: Number(ref.order) || 0,
              },
            ]
          : []
      ),
    })),
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
    version: full.version,
    tags: (full.recipeTags ?? [])
      .map((rt: any) => rt.tag)
      .filter((tag: { name?: string; version?: number } | null | undefined) => tag?.name)
      .map((tag: { name: string; version: number }) => ({ name: tag.name, version: tag.version })),
    cuisines: (full.recipeCuisines ?? [])
      .map((rc: any) => rc.cuisine)
      .filter((cuisine: { name?: string } | null | undefined) => cuisine?.name)
      .map((cuisine: { id: string; name: string; version: number }) => ({
        id: cuisine.id,
        name: cuisine.name,
        version: cuisine.version,
      })),
    recipeIngredients: (full.ingredients ?? []).map((ri: any) => ({
      id: ri.id,
      ingredientId: ri.ingredientId,
      amount: ri.amount ? Number(ri.amount) : null,
      unit: ri.unit ?? null,
      systemUsed: ri.systemUsed,
      ingredientName: ri.ingredient?.name ?? "",
      order: ri.order,
      version: ri.version,
    })),
    author,
    images: (full.images ?? []).map((img: any) => ({
      id: img.id,
      image: img.image,
      order: Number(img.order) || 0,
      generated: img.generated === true,
      version: img.version,
    })),
    videos: (full.videos ?? []).map((vid: any) => ({
      id: vid.id,
      video: vid.video,
      thumbnail: vid.thumbnail ?? null,
      duration: vid.duration ?? null,
      order: Number(vid.order) || 0,
      version: vid.version,
    })),
  };

  const parsed = FullRecipeSchema.safeParse(dto);

  if (!parsed.success) {
    dbLogger.error({ err: parsed.error }, "Failed to parse FullRecipeDTO");

    throw new Error("Failed to parse FullRecipeDTO");
  }

  return parsed.data;
}

export async function addStepsAndIngredientsToRecipeByInput(
  steps: StepInsertDto[],
  ingredients: RecipeIngredientInsertDto[]
): Promise<{ steps: StepDto[]; ingredients: RecipeIngredientsDto[] }> {
  if (!steps?.length && !ingredients?.length) {
    return { steps: [], ingredients: [] };
  }

  return db.transaction(async (tx) => {
    let createdSteps: StepDto[] = [];
    let createdIngredients: RecipeIngredientsDto[] = [];

    // Ingredients before steps, so step payloads that carry Step Ingredient
    // references can land them on the lines this same call creates.
    if (ingredients?.length) {
      createdIngredients = await attachIngredientsToRecipeByInputTx(tx, ingredients);
    }

    if (steps?.length) {
      createdSteps = await createManyRecipeStepsTx(tx, steps);
    }

    return {
      steps: createdSteps,
      ingredients: createdIngredients,
    };
  });
}

async function resolveRecipeIngredientIdsTx(
  tx: any,
  inputs: NonNullable<FullRecipeUpdateDTO["recipeIngredients"]>
) {
  const names = Array.from(
    new Set(inputs.map((item) => item.ingredientName?.trim() ?? "").filter(Boolean))
  );
  const resolvedIngredients = names.length > 0 ? await getOrCreateManyIngredientsTx(tx, names) : [];

  return inputs.map((item) => ({
    ...item,
    ingredientId:
      item.ingredientId ??
      resolvedIngredients.find(
        (ingredient) =>
          ingredient.name.toLowerCase().trim() === item.ingredientName?.toLowerCase().trim()
      )?.id ??
      null,
  }));
}

async function syncRecipeIngredientsTx(
  tx: any,
  recipeId: string,
  systemUsed: MeasurementSystem,
  inputs: NonNullable<FullRecipeUpdateDTO["recipeIngredients"]>
): Promise<void> {
  const existing = await tx
    .select({ id: recipeIngredients.id })
    .from(recipeIngredients)
    .where(
      and(eq(recipeIngredients.recipeId, recipeId), eq(recipeIngredients.systemUsed, systemUsed))
    );
  const existingById = new Map(existing.map((row: { id: string }) => [row.id, row]));
  const resolvedInputs = await resolveRecipeIngredientIdsTx(tx, inputs);
  const units = await getUnitsForNormalization();
  const retainedIds = new Set<string>();

  for (const [index, ingredient] of resolvedInputs.entries()) {
    if (!ingredient.ingredientId) continue;

    const values = {
      ingredientId: ingredient.ingredientId,
      amount: ingredient.amount ?? null,
      unit: ingredient.unit ? normalizeUnit(ingredient.unit, units) : null,
      order: ingredient.order ?? index,
      systemUsed,
    };

    if (ingredient.id && existingById.has(ingredient.id)) {
      retainedIds.add(ingredient.id);
      await tx
        .update(recipeIngredients)
        .set({ ...values, version: sql`${recipeIngredients.version} + 1` })
        .where(eq(recipeIngredients.id, ingredient.id));
      continue;
    }

    await tx.insert(recipeIngredients).values({
      recipeId,
      ...values,
    });
  }

  const idsToDelete = existing
    .map((row: { id: string }) => row.id)
    .filter((id: string) => !retainedIds.has(id));

  if (idsToDelete.length > 0) {
    await tx.delete(recipeIngredients).where(inArray(recipeIngredients.id, idsToDelete));
  }
}

async function syncStepImagesTx(
  tx: any,
  stepId: string,
  images: Array<{ id?: string; image: string; order?: unknown; version?: number }>
): Promise<void> {
  const existing = await tx
    .select({ id: stepImages.id })
    .from(stepImages)
    .where(eq(stepImages.stepId, stepId));
  const existingById = new Map(existing.map((row: { id: string }) => [row.id, row]));
  const retainedIds = new Set<string>();

  for (const [index, image] of images.entries()) {
    const values = {
      image: image.image,
      order: String(typeof image.order === "number" ? image.order : index),
    };

    if (image.id && existingById.has(image.id)) {
      retainedIds.add(image.id);
      await tx
        .update(stepImages)
        .set({ ...values, version: sql`${stepImages.version} + 1` })
        .where(eq(stepImages.id, image.id));
      continue;
    }

    await tx.insert(stepImages).values({ stepId, ...values });
  }

  const idsToDelete = existing
    .map((row: { id: string }) => row.id)
    .filter((id: string) => !retainedIds.has(id));

  if (idsToDelete.length > 0) {
    await tx.delete(stepImages).where(inArray(stepImages.id, idsToDelete));
  }
}

async function syncRecipeStepsTx(
  tx: any,
  recipeId: string,
  systemUsed: MeasurementSystem,
  inputs: NonNullable<FullRecipeUpdateDTO["steps"]>
): Promise<void> {
  const normalized = inputs
    .map((step, index) => ({
      ...step,
      order: step.order ?? index,
      step: stripHtmlTags(step.step),
    }))
    .filter((step) => step.step.length > 0);
  const existing = await tx
    .select({ id: stepsTable.id })
    .from(stepsTable)
    .where(and(eq(stepsTable.recipeId, recipeId), eq(stepsTable.systemUsed, systemUsed)))
    .orderBy(asc(stepsTable.order));
  // The ingredient sync has already run (updateRecipeWithRefs orders it
  // first), so the payload's by-order Step Ingredient references resolve
  // against the lines exactly as this save left them.
  const lineIdByOrder = await loadIngredientLineIdsByOrderTx(tx, recipeId, systemUsed);

  for (const [index, step] of normalized.entries()) {
    const existingStep = existing[index];
    const values = {
      recipeId,
      step: step.step,
      order: index,
      systemUsed,
    };

    if (existingStep) {
      await tx
        .update(stepsTable)
        .set({ ...values, version: sql`${stepsTable.version} + 1` })
        .where(eq(stepsTable.id, existingStep.id));
      await syncStepImagesTx(tx, existingStep.id, step.images ?? []);
      await syncStepIngredientsTx(tx, existingStep.id, step.stepIngredients ?? [], lineIdByOrder);
      continue;
    }

    const [insertedStep] = await tx
      .insert(stepsTable)
      .values(values)
      .returning({ id: stepsTable.id });

    if (insertedStep) {
      await syncStepImagesTx(tx, insertedStep.id, step.images ?? []);
      await syncStepIngredientsTx(tx, insertedStep.id, step.stepIngredients ?? [], lineIdByOrder);
    }
  }

  const idsToDelete = existing.slice(normalized.length).map((row: { id: string }) => row.id);

  if (idsToDelete.length > 0) {
    await tx.delete(stepsTable).where(inArray(stepsTable.id, idsToDelete));
  }
}

async function syncRecipeImagesTx(
  tx: any,
  recipeId: string,
  images: NonNullable<FullRecipeUpdateDTO["images"]>
): Promise<void> {
  const existing = await tx
    .select({ id: recipeImages.id })
    .from(recipeImages)
    .where(eq(recipeImages.recipeId, recipeId));
  const existingById = new Map(existing.map((row: { id: string }) => [row.id, row]));
  const retainedIds = new Set<string>();

  for (const [index, image] of images.entries()) {
    const values = {
      image: image.image,
      order: String(image.order ?? index),
      // An absent field carries no intent: an edit-form save must not clear
      // a stored marking, so only an explicit value is written on update.
      ...(image.generated !== undefined ? { generated: image.generated } : {}),
    };

    if (image.id && existingById.has(image.id)) {
      retainedIds.add(image.id);
      await tx
        .update(recipeImages)
        .set({ ...values, version: sql`${recipeImages.version} + 1` })
        .where(eq(recipeImages.id, image.id));
      continue;
    }

    await tx.insert(recipeImages).values({ recipeId, generated: false, ...values });
  }

  const idsToDelete = existing
    .map((row: { id: string }) => row.id)
    .filter((id: string) => !retainedIds.has(id));

  if (idsToDelete.length > 0) {
    await tx.delete(recipeImages).where(inArray(recipeImages.id, idsToDelete));
  }
}

async function syncRecipeVideosTx(
  tx: any,
  recipeId: string,
  videos: NonNullable<FullRecipeUpdateDTO["videos"]>
): Promise<void> {
  const existing = await tx
    .select({ id: recipeVideos.id })
    .from(recipeVideos)
    .where(eq(recipeVideos.recipeId, recipeId));
  const existingById = new Map(existing.map((row: { id: string }) => [row.id, row]));
  const retainedIds = new Set<string>();

  for (const [index, video] of videos.entries()) {
    const values = {
      video: video.video,
      thumbnail: video.thumbnail ?? null,
      duration: video.duration != null ? String(video.duration) : null,
      order: String(video.order ?? index),
    };

    if (video.id && existingById.has(video.id)) {
      retainedIds.add(video.id);
      await tx
        .update(recipeVideos)
        .set({ ...values, version: sql`${recipeVideos.version} + 1` })
        .where(eq(recipeVideos.id, video.id));
      continue;
    }

    await tx.insert(recipeVideos).values({ recipeId, ...values });
  }

  const idsToDelete = existing
    .map((row: { id: string }) => row.id)
    .filter((id: string) => !retainedIds.has(id));

  if (idsToDelete.length > 0) {
    await tx.delete(recipeVideos).where(inArray(recipeVideos.id, idsToDelete));
  }
}

export async function updateRecipeWithRefs(
  recipeId: string,
  userId: string,
  input: FullRecipeUpdateDTO,
  version?: number
): Promise<MutationOutcome<void>> {
  const parsed = FullRecipeUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid FullRecipeUpdateDTO");
  }

  const payload = parsed.data;

  return await db.transaction(async (tx) => {
    // Update recipe base fields
    const updateData: any = {};

    if (payload.name !== undefined) updateData.name = stripHtmlTags(payload.name);
    if (payload.description !== undefined)
      updateData.description = payload.description ? stripHtmlTags(payload.description) : null;
    if (payload.notes !== undefined) updateData.notes = payload.notes;
    if (payload.url !== undefined) updateData.url = payload.url;
    // The deprecated scalar is never written with a value again: any update
    // that touches media clears it, so a stale fallback cannot linger behind
    // the gallery. An update that says nothing about media leaves legacy
    // rows alone — stripping their only image is the migration's job, not a
    // rename's.
    if (payload.image !== undefined || payload.images !== undefined) updateData.image = null;
    if (payload.dishColor !== undefined) updateData.dishColor = payload.dishColor;
    if (payload.servings !== undefined) updateData.servings = payload.servings;
    if (payload.prepMinutes !== undefined) updateData.prepMinutes = payload.prepMinutes;
    if (payload.cookMinutes !== undefined) updateData.cookMinutes = payload.cookMinutes;
    if (payload.totalMinutes !== undefined) updateData.totalMinutes = payload.totalMinutes;
    if (payload.systemUsed !== undefined) updateData.systemUsed = payload.systemUsed;
    if (payload.calories !== undefined) updateData.calories = payload.calories;
    if (payload.categories !== undefined && payload.categories?.length > 0)
      updateData.categories = payload.categories;
    if (payload.fat !== undefined) updateData.fat = payload.fat;
    if (payload.carbs !== undefined) updateData.carbs = payload.carbs;
    if (payload.protein !== undefined) updateData.protein = payload.protein;
    if (payload.originCountry !== undefined)
      updateData.originCountry = normalizeOriginCountry(payload.originCountry);
    if (payload.originCountryName !== undefined || payload.originCountry !== undefined)
      // The written name accompanies the code: clearing or changing the code
      // without a fresh name clears the stale name with it.
      updateData.originCountryName =
        normalizeOriginCountry(payload.originCountry) && payload.originCountryName
          ? stripHtmlTags(payload.originCountryName)
          : null;
    if (payload.originRegion !== undefined)
      updateData.originRegion = payload.originRegion ? stripHtmlTags(payload.originRegion) : null;
    if (payload.provenanceNote !== undefined)
      updateData.provenanceNote = payload.provenanceNote
        ? stripHtmlTags(payload.provenanceNote)
        : null;

    updateData.updatedAt = new Date();

    const whereConditions = [eq(recipes.id, recipeId)];

    if (version) {
      whereConditions.push(eq(recipes.version, version));
    }

    const [updatedRecipeRow] = await tx
      .update(recipes)
      .set({ ...updateData, version: sql`${recipes.version} + 1` })
      .where(and(...whereConditions))
      .returning({ id: recipes.id });

    if (!updatedRecipeRow && version) {
      return staleOutcome();
    }

    // Replace Cuisines if provided. An empty array is an editor clearing them,
    // which is deliberately distinct from an enrichment run writing nothing.
    if (payload.cuisines !== undefined) {
      await replaceRecipeCuisinesTx(tx, recipeId, payload.cuisines);
    }

    // Replace tags if provided
    if (payload.tags !== undefined) {
      await attachTagsToRecipeByInputTx(
        tx,
        recipeId,
        payload.tags.map((t) => t.name)
      );
    }

    // Replace ingredients if provided
    if (payload.recipeIngredients !== undefined) {
      // Determine which system is being updated
      let systemToUpdate = payload.systemUsed;

      // If systemUsed is not provided at top level, infer it from the ingredients themselves
      if (!systemToUpdate && payload.recipeIngredients.length > 0) {
        const inferredSystems = new Set(
          payload.recipeIngredients.map((ri) => ri.systemUsed).filter(Boolean)
        );

        // If all ingredients use the same system, use that
        if (inferredSystems.size === 1) {
          systemToUpdate = Array.from(inferredSystems)[0];
        }
      }

      // Only delete ingredients for the system being updated (preserve other systems)
      if (systemToUpdate) {
        await syncRecipeIngredientsTx(
          tx,
          recipeId,
          systemToUpdate,
          payload.recipeIngredients.map((ri) => ({
            ...ri,
            recipeId,
            ingredientId: ri.ingredientId ?? null,
            amount: ri.amount ?? null,
            order: ri.order ?? 0,
          }))
        );
      } else {
        // If we still can't determine the system, this is an error
        throw new Error("Cannot determine which measurement system to update.");
      }
    }

    // Replace steps if provided
    if (payload.steps !== undefined) {
      // Determine which system is being updated
      let systemToUpdate = payload.systemUsed;

      // If systemUsed is not provided at top level, infer it from the steps themselves
      if (!systemToUpdate && payload.steps.length > 0) {
        const inferredSystems = new Set(payload.steps.map((s) => s.systemUsed).filter(Boolean));

        // If all steps use the same system, use that
        if (inferredSystems.size === 1) {
          systemToUpdate = Array.from(inferredSystems)[0];
        }
      }

      // Only delete steps for the system being updated (preserve other systems)
      if (systemToUpdate) {
        await syncRecipeStepsTx(tx, recipeId, systemToUpdate, payload.steps);
      } else {
        // If we still can't determine the system, this is an error
        throw new Error("Cannot determine which measurement system to update.");
      }
    }

    // Replace images if provided
    if (payload.images !== undefined) {
      await syncRecipeImagesTx(tx, recipeId, payload.images);
    }

    // The legacy alias: a payload scalar lands in the gallery whenever the
    // gallery ends up empty — a scalar-only PATCH, or an overwrite-import of
    // a gallery-less archive whose hero travels beside `images: []`. With a
    // gallery present it is dropped: no reader has consulted the scalar past
    // a gallery row since the thumbnails went gallery-first.
    const updateScalar = typeof payload.image === "string" ? payload.image.trim() : "";

    if (updateScalar !== "") {
      const existingGallery = await tx
        .select({ id: recipeImages.id })
        .from(recipeImages)
        .where(eq(recipeImages.recipeId, recipeId))
        .limit(1);

      if (existingGallery.length === 0) {
        await tx.insert(recipeImages).values({ recipeId, image: updateScalar, order: "0" });
      }
    }

    // Replace videos if provided
    if (payload.videos !== undefined) {
      await syncRecipeVideosTx(tx, recipeId, payload.videos);
    }

    return appliedOutcome(undefined);
  });
}

export interface RandomRecipeCandidate {
  id: string;
  name: string;
  image: string | null;
  categories: RecipeCategory[];
  householdFavoriteCount: number;
  householdAverageRating: number | null;
}

export async function getRandomRecipeCandidates(
  ctx: RecipeListContext,
  category?: RecipeCategory
): Promise<RandomRecipeCandidate[]> {
  const whereConditions: any[] = [];

  const policyCondition = await buildViewPolicyCondition(ctx);

  if (policyCondition) {
    whereConditions.push(policyCondition);
  }

  if (category) {
    whereConditions.push(sql`${category} = ANY(${recipes.categories})`);
  }

  const whereClause = whereConditions.length ? and(...whereConditions) : undefined;

  const householdUserIds = ctx.householdUserIds ?? [ctx.userId];

  const rows = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      image: PRIMARY_IMAGE_SQL,
      categories: recipes.categories,
    })
    .from(recipes)
    .where(whereClause);

  if (rows.length === 0) return [];

  const recipeIds = rows.map((r) => r.id);

  const { recipeFavorites } = await import("../schema/recipe-favorites");
  const { recipeRatings } = await import("../schema/recipe-ratings");

  const [favoriteCounts, ratingAverages] = await Promise.all([
    db
      .select({
        recipeId: recipeFavorites.recipeId,
        count: sql<number>`count(*)::int`,
      })
      .from(recipeFavorites)
      .where(
        and(
          inArray(recipeFavorites.recipeId, recipeIds),
          inArray(recipeFavorites.userId, householdUserIds)
        )
      )
      .groupBy(recipeFavorites.recipeId),

    db
      .select({
        recipeId: recipeRatings.recipeId,
        avgRating: sql<number>`avg(${recipeRatings.rating})::float`,
      })
      .from(recipeRatings)
      .where(
        and(
          inArray(recipeRatings.recipeId, recipeIds),
          inArray(recipeRatings.userId, householdUserIds)
        )
      )
      .groupBy(recipeRatings.recipeId),
  ]);

  const favoriteMap = new Map(favoriteCounts.map((f) => [f.recipeId, f.count]));
  const ratingMap = new Map(ratingAverages.map((r) => [r.recipeId, r.avgRating]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    image: r.image,
    categories: r.categories ?? [],
    householdFavoriteCount: favoriteMap.get(r.id) ?? 0,
    householdAverageRating: ratingMap.get(r.id) ?? null,
  }));
}

export async function searchRecipesByName(
  ctx: RecipeListContext,
  query: string,
  limit: number = 10
): Promise<{ id: string; name: string; image: string | null }[]> {
  const whereConditions: any[] = [];

  const policyCondition = await buildViewPolicyCondition(ctx);

  if (policyCondition) {
    whereConditions.push(policyCondition);
  }

  whereConditions.push(ilike(recipes.name, `%${query}%`));
  const whereClause = whereConditions.length ? and(...whereConditions) : undefined;
  const rows = await db
    .select({ id: recipes.id, name: recipes.name, image: PRIMARY_IMAGE_SQL })
    .from(recipes)
    .where(whereClause)
    .orderBy(asc(recipes.name))
    .limit(limit);

  return rows.map((r) => ({ id: r.id, name: r.name, image: r.image }));
}

// --- Recipe Images Management ---

export interface RecipeImageInput {
  image: string;
  order: number;
}

/**
 * Add images to a recipe
 */
export async function addRecipeImages(
  recipeId: string,
  images: RecipeImageInput[]
): Promise<{ id: string; image: string; order: number; version: number }[]> {
  if (!images.length) return [];

  const inserted = await db
    .insert(recipeImages)
    .values(
      images.map((img) => ({
        recipeId,
        image: img.image,
        order: String(img.order),
      }))
    )
    .returning({
      id: recipeImages.id,
      image: recipeImages.image,
      order: recipeImages.order,
      version: recipeImages.version,
    });

  return inserted.map((row) => ({
    id: row.id,
    image: row.image,
    order: Number(row.order) || 0,
    version: row.version,
  }));
}

/**
 * Delete a recipe image by ID
 */
export async function deleteRecipeImageById(
  imageId: string,
  version?: number
): Promise<MutationOutcome<void>> {
  const whereConditions = [eq(recipeImages.id, imageId)];

  if (version) {
    whereConditions.push(eq(recipeImages.version, version));
  }

  const deleted = await db
    .delete(recipeImages)
    .where(and(...whereConditions))
    .returning({ id: recipeImages.id });

  if (deleted.length === 0 && version) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

/**
 * Get all images for a recipe
 */
export async function getRecipeImages(
  recipeId: string
): Promise<{ id: string; image: string; order: number; version: number }[]> {
  const rows = await db
    .select({
      id: recipeImages.id,
      image: recipeImages.image,
      order: recipeImages.order,
      version: recipeImages.version,
    })
    .from(recipeImages)
    .where(eq(recipeImages.recipeId, recipeId))
    .orderBy(asc(recipeImages.order));

  return rows.map((row) => ({
    id: row.id,
    image: row.image,
    order: Number(row.order) || 0,
    version: row.version,
  }));
}

/**
 * Update order of recipe images
 */
export async function updateRecipeImageOrder(imageId: string, newOrder: number): Promise<void> {
  await db
    .update(recipeImages)
    .set({ order: String(newOrder), version: sql`${recipeImages.version} + 1` })
    .where(eq(recipeImages.id, imageId));
}

/**
 * Get recipe image by ID (for permission checking)
 */
export async function getRecipeImageById(
  imageId: string
): Promise<{ id: string; recipeId: string; image: string } | null> {
  const [row] = await db
    .select({ id: recipeImages.id, recipeId: recipeImages.recipeId, image: recipeImages.image })
    .from(recipeImages)
    .where(eq(recipeImages.id, imageId))
    .limit(1);

  return row ?? null;
}

/**
 * Replace all images for a recipe (used during update)
 */
export async function replaceRecipeImages(
  recipeId: string,
  images: RecipeImageInput[]
): Promise<{ id: string; image: string; order: number; version: number }[]> {
  return db.transaction(async (tx) => {
    // Delete existing images
    await tx.delete(recipeImages).where(eq(recipeImages.recipeId, recipeId));

    if (!images.length) return [];

    // Insert new images
    const inserted = await tx
      .insert(recipeImages)
      .values(
        images.map((img) => ({
          recipeId,
          image: img.image,
          order: String(img.order),
        }))
      )
      .returning({
        id: recipeImages.id,
        image: recipeImages.image,
        order: recipeImages.order,
        version: recipeImages.version,
      });

    return inserted.map((row) => ({
      id: row.id,
      image: row.image,
      order: Number(row.order) || 0,
      version: row.version,
    }));
  });
}

/**
 * Count images for a recipe
 */
export async function countRecipeImages(recipeId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(recipeImages)
    .where(eq(recipeImages.recipeId, recipeId));

  return Number(result?.count ?? 0);
}

// --- Recipe Videos Management ---

export interface RecipeVideoInput {
  video: string;
  thumbnail?: string | null;
  duration?: number | null;
  order: number;
}

/**
 * Count videos for a recipe
 */
export async function countRecipeVideos(recipeId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(recipeVideos)
    .where(eq(recipeVideos.recipeId, recipeId));

  return Number(result?.count ?? 0);
}

/**
 * Add videos to a recipe
 */
export async function addRecipeVideos(
  recipeId: string,
  videos: RecipeVideoInput[]
): Promise<
  {
    id: string;
    video: string;
    thumbnail: string | null;
    duration: number | null;
    order: number;
    version: number;
  }[]
> {
  if (!videos.length) return [];

  const inserted = await db
    .insert(recipeVideos)
    .values(
      videos.map((v) => ({
        recipeId,
        video: v.video,
        thumbnail: v.thumbnail ?? null,
        duration: v.duration != null ? String(v.duration) : null,
        order: String(v.order),
      }))
    )
    .returning({
      id: recipeVideos.id,
      video: recipeVideos.video,
      thumbnail: recipeVideos.thumbnail,
      duration: recipeVideos.duration,
      order: recipeVideos.order,
      version: recipeVideos.version,
    });

  return inserted.map((row) => ({
    id: row.id,
    video: row.video,
    thumbnail: row.thumbnail,
    duration: row.duration != null ? Number(row.duration) : null,
    order: Number(row.order) || 0,
    version: row.version,
  }));
}

/**
 * Delete a recipe video by ID
 */
export async function deleteRecipeVideoById(
  videoId: string,
  version?: number
): Promise<MutationOutcome<void>> {
  const whereConditions = [eq(recipeVideos.id, videoId)];

  if (version) {
    whereConditions.push(eq(recipeVideos.version, version));
  }

  const deleted = await db
    .delete(recipeVideos)
    .where(and(...whereConditions))
    .returning({ id: recipeVideos.id });

  if (deleted.length === 0 && version) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

/**
 * Get all videos for a recipe
 */
export async function getRecipeVideos(recipeId: string): Promise<
  {
    id: string;
    video: string;
    thumbnail: string | null;
    duration: number | null;
    order: number;
    version: number;
  }[]
> {
  const rows = await db
    .select({
      id: recipeVideos.id,
      video: recipeVideos.video,
      thumbnail: recipeVideos.thumbnail,
      duration: recipeVideos.duration,
      order: recipeVideos.order,
      version: recipeVideos.version,
    })
    .from(recipeVideos)
    .where(eq(recipeVideos.recipeId, recipeId))
    .orderBy(asc(recipeVideos.order));

  return rows.map((row) => ({
    id: row.id,
    video: row.video,
    thumbnail: row.thumbnail,
    duration: row.duration != null ? Number(row.duration) : null,
    order: Number(row.order) || 0,
    version: row.version,
  }));
}

/**
 * Update order of recipe video
 */
export async function updateRecipeVideoOrder(videoId: string, newOrder: number): Promise<void> {
  await db
    .update(recipeVideos)
    .set({ order: String(newOrder), version: sql`${recipeVideos.version} + 1` })
    .where(eq(recipeVideos.id, videoId));
}

/**
 * Get recipe video by ID (for permission checking)
 */
export async function getRecipeVideoById(
  videoId: string
): Promise<{ id: string; recipeId: string; video: string } | null> {
  const [row] = await db
    .select({ id: recipeVideos.id, recipeId: recipeVideos.recipeId, video: recipeVideos.video })
    .from(recipeVideos)
    .where(eq(recipeVideos.id, videoId))
    .limit(1);

  return row ?? null;
}

/**
 * Replace all videos for a recipe (used during update)
 */
export async function replaceRecipeVideos(
  recipeId: string,
  videos: RecipeVideoInput[]
): Promise<
  {
    id: string;
    video: string;
    thumbnail: string | null;
    duration: number | null;
    order: number;
    version: number;
  }[]
> {
  return db.transaction(async (tx) => {
    // Delete existing videos
    await tx.delete(recipeVideos).where(eq(recipeVideos.recipeId, recipeId));

    if (!videos.length) return [];

    // Insert new videos
    const inserted = await tx
      .insert(recipeVideos)
      .values(
        videos.map((v) => ({
          recipeId,
          video: v.video,
          thumbnail: v.thumbnail ?? null,
          duration: v.duration != null ? String(v.duration) : null,
          order: String(v.order),
        }))
      )
      .returning({
        id: recipeVideos.id,
        video: recipeVideos.video,
        thumbnail: recipeVideos.thumbnail,
        duration: recipeVideos.duration,
        order: recipeVideos.order,
        version: recipeVideos.version,
      });

    return inserted.map((row) => ({
      id: row.id,
      video: row.video,
      thumbnail: row.thumbnail,
      duration: row.duration != null ? Number(row.duration) : null,
      order: Number(row.order) || 0,
      version: row.version,
    }));
  });
}

/**
 * List all media references stored in the database (recipe cover images,
 * gallery images, and videos). Used by startup media cleanup to detect
 * orphaned files on disk.
 */
export async function listAllRecipeMediaReferences(): Promise<{
  recipes: { id: string; image: string | null }[];
  galleryImageUrls: string[];
  videoUrls: string[];
}> {
  const [allRecipes, galleryImages, videos] = await Promise.all([
    db.select({ id: recipes.id, image: recipes.image }).from(recipes),
    db.select({ image: recipeImages.image }).from(recipeImages),
    db.select({ video: recipeVideos.video }).from(recipeVideos),
  ]);

  return {
    recipes: allRecipes,
    galleryImageUrls: galleryImages.map((row) => row.image),
    videoUrls: videos.map((row) => row.video),
  };
}

/**
 * Legacy image migration helpers. Used only by the startup gallery image
 * migration (`@norish/api/startup/migrate-gallery-images`).
 */
export async function listRecipeIdsAndImages(): Promise<{ id: string; image: string | null }[]> {
  return await db.select({ id: recipes.id, image: recipes.image }).from(recipes);
}

export async function listRecipesWithLegacyImageUrls(
  urlPrefix: string
): Promise<{ id: string; image: string | null }[]> {
  return await db
    .select({ id: recipes.id, image: recipes.image })
    .from(recipes)
    .where(like(recipes.image, `${urlPrefix}%`));
}

export async function updateRecipeImageUrl(recipeId: string, imageUrl: string): Promise<void> {
  await db.update(recipes).set({ image: imageUrl }).where(eq(recipes.id, recipeId));
}

export async function listGalleryImagesWithLegacyUrls(): Promise<
  { id: string; recipeId: string; image: string }[]
> {
  return await db
    .select({ id: recipeImages.id, recipeId: recipeImages.recipeId, image: recipeImages.image })
    .from(recipeImages)
    .where(
      or(like(recipeImages.image, "/recipes/images/%"), like(recipeImages.image, "%/gallery/%"))
    );
}

export async function updateGalleryImageUrl(imageId: string, imageUrl: string): Promise<void> {
  await db.update(recipeImages).set({ image: imageUrl }).where(eq(recipeImages.id, imageId));
}

/**
 * Dish Colour helpers (ADR-0023). The listing feeds the startup backfill:
 * rows stored before the colour existed, with whatever media could supply
 * one. Rows whose extraction fails stay null and are simply offered again
 * next startup — null is the defined "no colour" outcome, not an error state.
 */
export async function listRecipesMissingDishColor(): Promise<
  { id: string; image: string | null; galleryImages: { image: string; order: number | null }[] }[]
> {
  const [missing, galleryImages] = await Promise.all([
    db
      .select({ id: recipes.id, image: recipes.image })
      .from(recipes)
      .where(isNull(recipes.dishColor)),
    db
      .select({
        recipeId: recipeImages.recipeId,
        image: recipeImages.image,
        order: recipeImages.order,
      })
      .from(recipeImages),
  ]);

  const galleryByRecipe = new Map<string, { image: string; order: number | null }[]>();

  for (const galleryImage of galleryImages) {
    const list = galleryByRecipe.get(galleryImage.recipeId) ?? [];

    // `order` is a numeric column, so the driver hands it back as a string.
    list.push({
      image: galleryImage.image,
      order: galleryImage.order === null ? null : Number(galleryImage.order),
    });
    galleryByRecipe.set(galleryImage.recipeId, list);
  }

  return missing.map((recipe) => ({
    ...recipe,
    galleryImages: galleryByRecipe.get(recipe.id) ?? [],
  }));
}

export async function updateRecipeDishColor(
  recipeId: string,
  dishColor: string | null
): Promise<void> {
  await db.update(recipes).set({ dishColor }).where(eq(recipes.id, recipeId));
}

/**
 * The media a recipe's Dish Colour is derived from, for recomputing after a
 * direct gallery mutation. Null when the recipe does not exist.
 */
export async function getRecipeMediaForDishColor(recipeId: string): Promise<{
  image: string | null;
  galleryImages: { image: string; order: number | null }[];
} | null> {
  const [recipe] = await db
    .select({ image: recipes.image })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  if (!recipe) return null;

  const galleryImages = await getRecipeImages(recipeId);

  return {
    image: recipe.image,
    galleryImages: galleryImages.map((galleryImage) => ({
      image: galleryImage.image,
      order: galleryImage.order,
    })),
  };
}
