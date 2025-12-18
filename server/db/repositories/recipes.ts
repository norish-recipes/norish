import { eq, ilike, inArray, and, asc, desc, sql, or } from "drizzle-orm";
import z from "zod";

import { db } from "../drizzle";
import { recipes, recipeIngredients, steps as stepsTable } from "../schema";
import {
  RecipeDashboardSchema,
  FullRecipeInsertSchema,
  FullRecipeSchema,
  FullRecipeUpdateSchema,
} from "../zodSchemas";

import { attachIngredientsToRecipeByInputTx } from "./ingredients";
import { createManyRecipeStepsTx } from "./steps";
import { attachTagsToRecipeByInputTx } from "./tags";

import { stripHtmlTags } from "@/lib/helpers";
import { deleteRecipeStepImagesDir } from "@/lib/downloader";
import {
  RecipeDashboardDTO,
  FilterMode,
  SortOrder,
  FullRecipeInsertDTO,
  RecipeIngredientInsertDto,
  FullRecipeDTO,
  MeasurementSystem,
  RecipeIngredientsDto,
  FullRecipeUpdateDTO,
} from "@/types";
import { StepDto, StepInsertDto } from "@/types/dto/steps";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import { dbLogger } from "@/server/logger";

function nonEmpty(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

export async function GetTotalRecipeCount(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(recipes);

  return Number(result?.[0]?.count ?? 0);
}

export async function deleteRecipeById(id: string): Promise<void> {
  await deleteRecipeStepImagesDir(id);
  await db.delete(recipes).where(eq(recipes.id, id));
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
  let whereCondition;

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
  const policy = await getRecipePermissionPolicy();
  const viewLevel = policy.view;

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
  tagNames?: string[],
  filterMode: FilterMode = "OR",
  sortMode: SortOrder = "dateDesc",
  minRating?: number
): Promise<{ recipes: RecipeDashboardDTO[]; total: number }> {
  const whereConditions: any[] = [];

  // Apply view policy filtering
  const policyCondition = await buildViewPolicyCondition(ctx);

  if (policyCondition) {
    whereConditions.push(policyCondition);
  }

  if (search) {
    whereConditions.push(ilike(recipes.name, `%${search}%`));
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

  const whereClause = whereConditions.length ? and(...whereConditions) : undefined;

  const sortMap = {
    titleAsc: asc(recipes.name),
    titleDesc: desc(recipes.name),
    dateAsc: asc(recipes.createdAt),
    dateDesc: desc(recipes.createdAt),
  };
  const orderBy = sortMap[sortMode as keyof typeof sortMap] ?? desc(recipes.createdAt);

  const [rows, totalCount] = await Promise.all([
    db.query.recipes.findMany({
      columns: {
        id: true,
        userId: true,
        name: true,
        description: true,
        url: true,
        image: true,
        servings: true,
        prepMinutes: true,
        cookMinutes: true,
        totalMinutes: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        recipeTags: {
          with: { tag: { columns: { id: true, name: true } } },
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
      url: r.url ?? null,
      image: r.image ?? null,
      servings: r.servings ?? 1,
      prepMinutes: r.prepMinutes ?? null,
      cookMinutes: r.cookMinutes ?? null,
      totalMinutes: r.totalMinutes ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      tags: (r.recipeTags ?? [])
        .map((rt: { tag?: { name?: string } | null }) => rt.tag?.name)
        .filter((name: string | undefined | null): name is string => Boolean(name))
        .map((name) => ({ name })),
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
      url: true,
      image: true,
      servings: true,
      prepMinutes: true,
      cookMinutes: true,
      totalMinutes: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      recipeTags: {
        columns: {},
        with: {
          tag: { columns: { id: true, name: true } },
        },
      },
      ratings: {
        columns: { rating: true },
      },
    },
    limit: 1,
  });

  if (rows.length === 0) return null;
  const r = rows[0];

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
    url: r.url ?? null,
    image: r.image ?? null,
    servings: r.servings ?? null,
    prepMinutes: r.prepMinutes ?? null,
    cookMinutes: r.cookMinutes ?? null,
    totalMinutes: r.totalMinutes ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    tags: (r.recipeTags ?? [])
      .map((rt: any) => rt.tag?.name)
      .filter(nonEmpty)
      .map((name: string) => ({ name })),
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

  if (!parsed.success) {
    throw new Error("Invalid FullRecipeInsertDTO");
  }

  const payload = parsed.data;

  const toInsert = {
    id: recipeId,
    name: stripHtmlTags(payload.name),
    userId,
    description: payload.description ? stripHtmlTags(payload.description) : null,
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

    return rid;
  });

  return finalRecipeId;
}

export async function setActiveSystemForRecipe(
  recipeId: string,
  system: MeasurementSystem
): Promise<void> {
  await db.update(recipes).set({ systemUsed: system }).where(eq(recipes.id, recipeId));
}

export async function getRecipeFull(id: string): Promise<FullRecipeDTO | null> {
  const full = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
    columns: {
      id: true,
      userId: true,
      name: true,
      description: true,
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
      createdAt: true,
      updatedAt: true,
    },
    with: {
      recipeTags: {
        columns: {},
        with: { tag: { columns: { id: true, name: true } } },
      },
      ingredients: {
        columns: {
          ingredientId: true,
          amount: true,
          unit: true,
          systemUsed: true,
          order: true,
        },
        with: { ingredient: { columns: { name: true } } },
      },
      steps: {
        columns: { step: true, systemUsed: true, order: true },
        with: {
          images: {
            columns: { id: true, image: true, order: true },
          },
        },
      },
    },
  });

  if (!full) return null;

  // fetch author if exists
  let author: { id: string; name: string | null; image: string | null } | undefined;

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
    steps: ((full.steps as any) ?? []).map((s: any) => ({
      step: s.step,
      systemUsed: s.systemUsed,
      order: s.order,
      images: (s.images ?? []).map((img: any) => ({
        id: img.id,
        image: img.image,
        order: Number(img.order) || 0,
      })),
    })),
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
    tags: (full.recipeTags ?? [])
      .map((rt: any) => rt.tag?.name)
      .filter(nonEmpty)
      .map((name: string) => ({ name })),
    recipeIngredients: ((full.ingredients as any) ?? []).map((ri: any) => ({
      ingredientId: ri.ingredientId,
      amount: ri.amount ? Number(ri.amount) : null,
      unit: ri.unit ?? null,
      systemUsed: ri.systemUsed,
      ingredientName: ri.ingredient?.name ?? "",
      order: ri.order,
    })),
    author,
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

export async function updateRecipeWithRefs(
  recipeId: string,
  userId: string,
  input: FullRecipeUpdateDTO
): Promise<void> {
  const parsed = FullRecipeUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid FullRecipeUpdateDTO");
  }

  const payload = parsed.data;

  await db.transaction(async (tx) => {
    // Update recipe base fields
    const updateData: any = {};

    if (payload.name !== undefined) updateData.name = stripHtmlTags(payload.name);
    if (payload.description !== undefined)
      updateData.description = payload.description ? stripHtmlTags(payload.description) : null;
    if (payload.url !== undefined) updateData.url = payload.url;
    if (payload.image !== undefined) updateData.image = payload.image;
    if (payload.servings !== undefined) updateData.servings = payload.servings;
    if (payload.prepMinutes !== undefined) updateData.prepMinutes = payload.prepMinutes;
    if (payload.cookMinutes !== undefined) updateData.cookMinutes = payload.cookMinutes;
    if (payload.totalMinutes !== undefined) updateData.totalMinutes = payload.totalMinutes;
    if (payload.systemUsed !== undefined) updateData.systemUsed = payload.systemUsed;
    if (payload.calories !== undefined) updateData.calories = payload.calories;
    if (payload.fat !== undefined) updateData.fat = payload.fat;
    if (payload.carbs !== undefined) updateData.carbs = payload.carbs;
    if (payload.protein !== undefined) updateData.protein = payload.protein;
    
    updateData.updatedAt = new Date();

    if (Object.keys(updateData).length > 1) {
      // more than just updatedAt
      await tx.update(recipes).set(updateData).where(eq(recipes.id, recipeId));
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
      // Delete existing ingredients for this recipe
      await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));

      // Add new ones
      if (payload.recipeIngredients.length > 0) {
        await attachIngredientsToRecipeByInputTx(
          tx,
          payload.recipeIngredients.map((ri) => ({
            ...ri,
            recipeId,
            ingredientId: ri.ingredientId ?? null,
            amount: ri.amount ?? null,
            order: ri.order ?? 0,
          }))
        );
      }
    }

    // Replace steps if provided
    if (payload.steps !== undefined) {
      // Delete existing steps for this recipe
      await tx.delete(stepsTable).where(eq(stepsTable.recipeId, recipeId));

      // Add new ones
      if (payload.steps.length > 0) {
        await createManyRecipeStepsTx(
          tx,
          payload.steps.map((s) => ({
            ...s,
            recipeId,
          }))
        );
      }
    }
  });
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
