import { and, asc, desc, eq, ilike, inArray, lte, or, sql } from "drizzle-orm";
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
import { dbLogger } from "@norish/db/logger";
import { stripHtmlTags } from "@norish/shared/lib/helpers";

import type { MutationOutcome } from "./mutation-outcomes";
import { db } from "../drizzle";
import {
  ingredients,
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
import { attachIngredientsToRecipeByInputTx, getOrCreateManyIngredientsTx } from "./ingredients";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { getConfig } from "./server-config";
import { createManyRecipeStepsTx } from "./steps";
import { attachTagsToRecipeByInputTx } from "./tags";

type RecipeViewPolicy = RecipePermissionPolicy["view"];

async function getRecipeViewPolicy(): Promise<RecipeViewPolicy> {
  const policy = await getConfig<RecipePermissionPolicy>(ServerConfigKeys.RECIPE_PERMISSION_POLICY);

  return policy?.view ?? DEFAULT_RECIPE_PERMISSION_POLICY.view;
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
 * Build SQL condition for view policy filtering
 *
 * Recipes with null userId (orphaned recipes) are always visible to everyone.
 */
async function buildViewPolicyCondition(ctx: RecipeListContext) {
  const viewLevel = await getRecipeViewPolicy();

  // Server admin sees all
  if (ctx.isServerAdmin) {
    return undefined;
  }

  switch (viewLevel) {
    case "everyone":
      // No filtering needed
      return undefined;

    case "household":
      // User sees own recipes + household members' recipes + orphaned recipes (null userId)
      if (ctx.householdUserIds && ctx.householdUserIds.length > 0) {
        // Ensure user's own ID is included (should always be, but safety check)
        const userIds = ctx.householdUserIds.includes(ctx.userId)
          ? ctx.householdUserIds
          : [...ctx.householdUserIds, ctx.userId];

        // Include recipes where userId is in household OR userId is null (orphaned)
        return or(inArray(recipes.userId, userIds), sql`${recipes.userId} IS NULL`);
      }

      // No household = only own recipes + orphaned recipes
      return or(eq(recipes.userId, ctx.userId), sql`${recipes.userId} IS NULL`);

    case "owner":
      // Only own recipes + orphaned recipes (null userId)
      return or(eq(recipes.userId, ctx.userId), sql`${recipes.userId} IS NULL`);

    default:
      return or(eq(recipes.userId, ctx.userId), sql`${recipes.userId} IS NULL`);
  }
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
  categories?: RecipeCategory[]
): Promise<{ recipes: RecipeDashboardDTO[]; total: number }> {
  const whereConditions: any[] = [];

  // Apply view policy filtering
  const policyCondition = await buildViewPolicyCondition(ctx);

  if (policyCondition) {
    whereConditions.push(policyCondition);
  }

  // Build full-text search with weighted ranking
  // Priority: title (A) > tags (B) > ingredients (C) > description/steps (D)
  let searchRank: ReturnType<typeof sql<number>> | null = null;

  if (search && searchFields.length > 0) {
    // Convert search terms to tsquery format with prefix matching
    // Each term gets :* suffix for partial word matching (e.g., "om" matches "oma")
    // Sanitize terms to remove PostgreSQL tsquery special characters: & | ! ( ) : * \ ' "
    const sanitizeTsqueryTerm = (term: string): string =>
      term.replace(/[&|!():<>*\\'"]/g, "").trim();

    const searchTerms = search
      .trim()
      .split(/\s+/)
      .map(sanitizeTsqueryTerm)
      .filter((t) => t.length > 0)
      .map((t) => `${t}:*`)
      .join(" | ");

    // Skip search if all terms were filtered out (e.g., search was only special characters)
    if (!searchTerms) {
      // Fall through without adding search conditions
    } else {
      // Build weighted tsvector components based on selected fields
      const tsvectorParts: ReturnType<typeof sql>[] = [];

      for (const field of searchFields) {
        switch (field) {
          case "title":
            // Weight A (highest) for title
            tsvectorParts.push(
              sql`setweight(to_tsvector('simple', coalesce(${recipes.name}, '')), 'A')`
            );
            break;
          case "tags":
            // Weight B for tags - aggregate from related table
            tsvectorParts.push(
              sql`setweight(to_tsvector('simple', coalesce((
              SELECT string_agg(t.name, ' ')
              FROM ${recipeTags} rt
              INNER JOIN ${tags} t ON rt.tag_id = t.id
              WHERE rt.recipe_id = ${recipes.id}
            ), '')), 'B')`
            );
            break;
          case "ingredients":
            // Weight C for ingredients - aggregate from related table
            tsvectorParts.push(
              sql`setweight(to_tsvector('simple', coalesce((
              SELECT string_agg(i.name, ' ')
              FROM ${recipeIngredients} ri
              INNER JOIN ${ingredients} i ON ri.ingredient_id = i.id
              WHERE ri.recipe_id = ${recipes.id}
            ), '')), 'C')`
            );
            break;
          case "description":
            // Weight D for description
            tsvectorParts.push(
              sql`setweight(to_tsvector('simple', coalesce(${recipes.description}, '')), 'D')`
            );
            break;
          case "steps":
            // Weight D for steps - aggregate from related table
            tsvectorParts.push(
              sql`setweight(to_tsvector('simple', coalesce((
              SELECT string_agg(s.step, ' ')
              FROM ${stepsTable} s
              WHERE s.recipe_id = ${recipes.id}
            ), '')), 'D')`
            );
            break;
        }
      }

      if (tsvectorParts.length > 0) {
        // Combine all tsvector parts with ||
        const combinedTsvector = sql.join(tsvectorParts, sql` || `);
        const tsQuery = sql`to_tsquery('simple', ${searchTerms})`;

        // Add search condition using @@ operator
        whereConditions.push(sql`(${combinedTsvector}) @@ ${tsQuery}`);

        // Build rank expression for ordering
        searchRank = sql<number>`ts_rank(${combinedTsvector}, ${tsQuery})`;
      }
    }
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
      columns: {
        id: true,
        userId: true,
        name: true,
        description: true,
        notes: true,
        url: true,
        image: true,
        servings: true,
        prepMinutes: true,
        cookMinutes: true,
        totalMinutes: true,
        calories: true,
        categories: true,
        createdAt: true,
        updatedAt: true,
        version: true,
      },
      with: {
        recipeTags: {
          with: { tag: { columns: { id: true, name: true, version: true } } },
          orderBy: (rt, { asc }) => [asc(rt.order)],
        },
        ratings: {
          columns: { rating: true },
        },
      },
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

  const formatted = rows.map((r) => {
    // Compute average rating
    const ratingValues = (r.ratings ?? []).map((rating) => rating.rating);
    const ratingCount = ratingValues.length;
    const averageRating =
      ratingCount > 0 ? ratingValues.reduce((sum, val) => sum + val, 0) / ratingCount : null;

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
      categories: r.categories ?? [],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      version: r.version,
      tags: (r.recipeTags ?? []).flatMap(
        (rt: { tag?: { name?: string; version?: number } | null }) =>
          rt.tag && typeof rt.tag.name === "string" && typeof rt.tag.version === "number"
            ? [{ name: rt.tag.name, version: rt.tag.version }]
            : []
      ),
      averageRating,
      ratingCount,
    };
  });

  const parsed = z.array(RecipeDashboardSchema).safeParse(formatted);

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

export async function dashboardRecipe(id: string): Promise<RecipeDashboardDTO | null> {
  const rows = await db.query.recipes.findMany({
    where: eq(recipes.id, id),
    columns: {
      id: true,
      userId: true,
      name: true,
      description: true,
      notes: true,
      url: true,
      image: true,
      servings: true,
      prepMinutes: true,
      cookMinutes: true,
      totalMinutes: true,
      calories: true,
      categories: true,
      createdAt: true,
      updatedAt: true,
      version: true,
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

export async function createRecipeWithRefs(
  recipeId: string,
  userId: string | null | undefined,
  input: FullRecipeInsertDTO
): Promise<string | null> {
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
    image: payload.image ?? null,
    servings: payload.servings ?? 1,
    systemUsed: payload.systemUsed,
    prepMinutes: payload.prepMinutes ?? null,
    cookMinutes: payload.cookMinutes ?? null,
    totalMinutes: payload.totalMinutes ?? null,
    calories: payload.calories ?? null,
    fat: payload.fat ?? null,
    carbs: payload.carbs ?? null,
    protein: payload.protein ?? null,
    categories: payload.categories ?? [],
  };

  const finalRecipeId = await db.transaction(async (tx) => {
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

      return existing.id;
    }

    const rid = inserted.id;

    if (payload.tags.length) {
      await attachTagsToRecipeByInputTx(
        tx,
        rid,
        payload.tags.map((t) => t.name)
      );
    }

    if (payload.recipeIngredients.length) {
      await attachIngredientsToRecipeByInputTx(
        tx,
        payload.recipeIngredients.map((ri) => ({
          ...ri,
          recipeId: rid,
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

    // Insert gallery images if provided
    if (payload.images && payload.images.length > 0) {
      await tx.insert(recipeImages).values(
        payload.images.map((img) => ({
          recipeId: rid,
          image: img.image,
          order: String(img.order ?? 0),
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

    return rid;
  });

  return finalRecipeId;
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

export async function getRecipesWithoutCategories(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(sql`cardinality(${recipes.categories}) = 0`);

  return rows;
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
      servings: true,
      prepMinutes: true,
      cookMinutes: true,
      totalMinutes: true,
      systemUsed: true,
      calories: true,
      fat: true,
      carbs: true,
      protein: true,
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
      },
      steps: {
        columns: { step: true, systemUsed: true, order: true, version: true },
        with: {
          images: {
            columns: { id: true, image: true, order: true, version: true },
          },
        },
      },
      images: {
        columns: { id: true, image: true, order: true, version: true },
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
    | { id: string; name: string | null; image: string | null; version: number }
    | undefined;

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
    servings: full.servings ?? 1,
    prepMinutes: full.prepMinutes ?? null,
    cookMinutes: full.cookMinutes ?? null,
    totalMinutes: full.totalMinutes ?? null,
    systemUsed: full.systemUsed,
    calories: full.calories ?? null,
    fat: full.fat ?? null,
    carbs: full.carbs ?? null,
    protein: full.protein ?? null,
    categories: full.categories ?? [],
    steps: ((full.steps as any) ?? []).map((s: any) => ({
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
    })),
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
    version: full.version,
    tags: (full.recipeTags ?? [])
      .map((rt: any) => rt.tag)
      .filter((tag: { name?: string; version?: number } | null | undefined) => tag?.name)
      .map((tag: { name: string; version: number }) => ({ name: tag.name, version: tag.version })),
    recipeIngredients: ((full.ingredients as any) ?? []).map((ri: any) => ({
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

    if (steps?.length) {
      createdSteps = await createManyRecipeStepsTx(tx, steps);
    }

    if (ingredients?.length) {
      createdIngredients = await attachIngredientsToRecipeByInputTx(tx, ingredients);
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
  const retainedIds = new Set<string>();

  for (const [index, ingredient] of resolvedInputs.entries()) {
    if (!ingredient.ingredientId) continue;

    const values = {
      ingredientId: ingredient.ingredientId,
      amount: ingredient.amount ?? null,
      unit: ingredient.unit ?? null,
      order: ingredient.order ?? index,
      systemUsed: ingredient.systemUsed ?? systemUsed,
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

  for (const [index, step] of normalized.entries()) {
    const existingStep = existing[index];
    const values = {
      recipeId,
      step: step.step,
      order: index,
      systemUsed: step.systemUsed ?? systemUsed,
    };

    if (existingStep) {
      await tx
        .update(stepsTable)
        .set({ ...values, version: sql`${stepsTable.version} + 1` })
        .where(eq(stepsTable.id, existingStep.id));
      await syncStepImagesTx(tx, existingStep.id, step.images ?? []);
      continue;
    }

    const [insertedStep] = await tx
      .insert(stepsTable)
      .values(values)
      .returning({ id: stepsTable.id });

    if (insertedStep) {
      await syncStepImagesTx(tx, insertedStep.id, step.images ?? []);
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
    };

    if (image.id && existingById.has(image.id)) {
      retainedIds.add(image.id);
      await tx
        .update(recipeImages)
        .set({ ...values, version: sql`${recipeImages.version} + 1` })
        .where(eq(recipeImages.id, image.id));
      continue;
    }

    await tx.insert(recipeImages).values({ recipeId, ...values });
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
    if (payload.image !== undefined) updateData.image = payload.image;
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
          systemToUpdate = Array.from(inferredSystems)[0] as any;
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
          systemToUpdate = Array.from(inferredSystems)[0] as any;
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
      image: recipes.image,
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
    .select({ id: recipes.id, name: recipes.name, image: recipes.image })
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
