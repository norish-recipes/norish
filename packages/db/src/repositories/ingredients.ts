import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import z from "zod";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { IngredientDto } from "@norish/shared/contracts/dto/ingredient";
import type { MeasurementSystem } from "@norish/shared/contracts/dto/recipe";
import type {
  RecipeIngredientInsertDto,
  RecipeIngredientsDto,
} from "@norish/shared/contracts/dto/recipe-ingredient";
import defaultUnits from "@norish/config/units.default.json";
import {
  ServerConfigKeys,
  UnitsConfigSchema,
  UnitsMapSchema,
} from "@norish/config/zod/server-config";
import { db } from "@norish/db/drizzle";
import { dbLogger } from "@norish/db/logger";
import { getConfig } from "@norish/db/repositories/server-config";
import { ingredients, recipeIngredients } from "@norish/db/schema";
import { IngredientSelectBaseSchema } from "@norish/shared/contracts/zod";
import {
  RecipeIngredientInputSchema,
  RecipeIngredientSelectWithNameSchema,
  RecipeIngredientsInsertBaseSchema,
} from "@norish/shared/contracts/zod/recipe-ingredients";
import { stripHtmlTags } from "@norish/shared/lib/helpers";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";
import { normalizeUnit } from "@norish/shared/lib/unit-localization";

const IngredientArraySchema = z.array(IngredientSelectBaseSchema);

/**
 * The columns a new Ingredient Name row is written with: the name and its
 * folded form, which is what the Pantry matches on (ADR-0032). Used by every
 * path that mints Ingredient Names, so a name is folded the moment it exists.
 */
function ingredientNameRowValues(names: readonly string[]) {
  return names.map((name) => ({ name, normalizedName: normalizeGroceryName(name) }));
}

export async function getUnitsForNormalization(): Promise<UnitsMap> {
  const value = await getConfig<unknown>(ServerConfigKeys.UNITS);

  const wrapped = UnitsConfigSchema.safeParse(value);

  if (wrapped.success) {
    return wrapped.data.units;
  }

  const legacyWrapped =
    typeof value === "object" && value !== null && "units" in value && "isOverwritten" in value
      ? UnitsMapSchema.safeParse((value as { units: unknown }).units)
      : null;

  if (legacyWrapped?.success) {
    return legacyWrapped.data;
  }

  const legacy = UnitsMapSchema.safeParse(value);

  if (legacy.success) {
    return legacy.data;
  }

  return defaultUnits as UnitsMap;
}

function ensureNonEmptyName(name?: string): string {
  if (name === undefined || name === null) throw new Error("Ingredient name cannot be empty");

  const cleaned = stripHtmlTags(name);

  if (cleaned.length === 0) throw new Error("Ingredient name cannot be empty");

  return cleaned;
}

export async function findIngredientById(id: string): Promise<IngredientDto | null> {
  const rows = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1);
  const parsed = IngredientSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
}

async function findIngredientByName(name: string): Promise<IngredientDto | null> {
  const cleaned = ensureNonEmptyName(name);
  const rows = await db
    .select()
    .from(ingredients)
    .where(eq(sql`lower(${ingredients.name})`, cleaned.toLowerCase()))
    .limit(1);

  const parsed = IngredientSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
}

async function createIngredient(name: string): Promise<IngredientDto> {
  const cleaned = ensureNonEmptyName(name);

  await db
    .insert(ingredients)
    .values(ingredientNameRowValues([cleaned]))
    .onConflictDoNothing();

  const after = await findIngredientByName(cleaned);

  if (!after) throw new Error("Failed to create or fetch ingredient");

  return after;
}

export async function getOrCreateIngredientByName(name: string): Promise<IngredientDto> {
  const cleaned = ensureNonEmptyName(name);

  const existing = await findIngredientByName(cleaned);

  if (existing) return existing;

  return createIngredient(cleaned);
}

export async function findManyIngredientsByNames(names: string[]): Promise<IngredientDto[]> {
  const cleaned = names.map(stripHtmlTags).filter((n) => n.length > 0);

  if (cleaned.length === 0) return [];

  const lowers = Array.from(new Set(cleaned.map((n) => n.toLowerCase())));

  const rows = await db
    .select()
    .from(ingredients)
    .where(inArray(sql`lower(${ingredients.name})`, lowers));

  const parsed = IngredientArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse ingredients");

  return parsed.data;
}

export async function getOrCreateManyIngredients(names: string[]): Promise<IngredientDto[]> {
  // Clean and drop empties; preserve original case
  const cleaned = names.map(stripHtmlTags).filter((n) => n.length > 0);

  if (cleaned.length === 0) return [];

  return await db.transaction(async (tx) => {
    await tx.insert(ingredients).values(ingredientNameRowValues(cleaned)).onConflictDoNothing();

    const lowers = Array.from(new Set(cleaned.map((n) => n.toLowerCase())));

    const rows = await tx
      .select()
      .from(ingredients)
      .where(inArray(sql`lower(${ingredients.name})`, lowers));

    const parsed = IngredientArraySchema.safeParse(rows);

    if (!parsed.success) throw new Error("Failed to parse ingredients after insert");

    return parsed.data;
  });
}

export async function getOrCreateManyIngredientsTx(
  tx: any,
  names: string[]
): Promise<IngredientDto[]> {
  const cleaned = names.map(stripHtmlTags).filter((n) => n.length > 0);

  if (cleaned.length === 0) return [];

  await tx.insert(ingredients).values(ingredientNameRowValues(cleaned)).onConflictDoNothing();

  const lowers = Array.from(new Set(cleaned.map((n) => n.toLowerCase())));
  const rows = await tx
    .select()
    .from(ingredients)
    .where(inArray(sql`lower(${ingredients.name})`, lowers));

  const parsed = IngredientArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse ingredients after insert (tx)");

  return parsed.data;
}

export async function attachIngredientsToRecipeByInputTx(
  tx: any,
  payloadIngredients: RecipeIngredientInsertDto[]
): Promise<RecipeIngredientsDto[]> {
  if (!payloadIngredients?.length) return [];

  const parsedInput = z.array(RecipeIngredientInputSchema).safeParse(payloadIngredients);

  if (!parsedInput.success) {
    dbLogger.error({ err: parsedInput.error }, "Invalid RecipeIngredientsDto");
    throw new Error("Invalid RecipeIngredientsDto");
  }
  const items = parsedInput.data;

  // Get units config for normalization
  const units = await getUnitsForNormalization();

  // Separate items with ingredientId (already exist) from those needing creation (ingredientName)
  const itemsWithId = items.filter((ri) => ri.ingredientId);
  const itemsNeedingCreation = items.filter((ri) => !ri.ingredientId && ri.ingredientName);

  // Create/fetch ingredients for items that only have ingredientName
  const names = Array.from(
    new Set(itemsNeedingCreation.map((ri) => ri.ingredientName?.trim() ?? "").filter(Boolean))
  );
  const createdIngredients = names.length > 0 ? await getOrCreateManyIngredientsTx(tx, names) : [];

  // Build rows for items that already have ingredientId
  const rowsWithExistingIds = itemsWithId.map((ri) => ({
    recipeId: ri.recipeId,
    ingredientId: ri.ingredientId!,
    amount: ri.amount != null ? Number(ri.amount) : null,
    unit: normalizeUnit(ri.unit ?? "", units),
    order: ri.order,
    systemUsed: (ri.systemUsed as MeasurementSystem) || "metric",
  }));

  // Build rows for items that needed ingredient creation
  const rowsWithNewIngredients = itemsNeedingCreation
    .map((ri) => {
      const ing =
        createdIngredients.find(
          (i) => i.name.toLowerCase().trim() === ri.ingredientName?.toLowerCase().trim()
        ) ??
        createdIngredients.find((i) =>
          i.name.toLowerCase().includes(ri.ingredientName?.toLowerCase().trim() ?? "")
        );

      if (!ing) return null;

      return {
        recipeId: ri.recipeId,
        ingredientId: ing.id,
        amount: ri.amount != null ? Number(ri.amount) : null,
        unit: normalizeUnit(ri.unit ?? "", units), // ← Normalize unit to canonical ID
        order: ri.order,
        systemUsed: (ri.systemUsed as MeasurementSystem) || "metric",
      };
    })
    .filter(Boolean);

  // Combine both sets of rows
  const rows = [...rowsWithExistingIds, ...rowsWithNewIngredients];

  if (!rows.length) return [];

  const rowsSchema = z.array(RecipeIngredientsInsertBaseSchema);
  const validatedRows = rowsSchema.safeParse(rows);

  if (!validatedRows.success) {
    dbLogger.error({ err: validatedRows.error }, "Invalid recipeIngredients insert payload");
    throw new Error("Invalid recipeIngredients insert payload");
  }

  const inserted = await tx
    .insert(recipeIngredients)
    .values(validatedRows.data)
    .onConflictDoNothing()
    .returning();

  if (!inserted.length) return [];

  // Fetch all ingredient names for the inserted items
  const allIngredientIds = inserted.map((ri: any) => ri.ingredientId);
  const allIngredients = await tx
    .select()
    .from(ingredients)
    .where(inArray(ingredients.id, allIngredientIds));

  const insertedWithNames = inserted.map((ri: any) => ({
    ...ri,
    amount: ri.amount != null ? Number(ri.amount) : null,
    ingredientName: allIngredients.find((i: any) => i.id === ri.ingredientId)?.name ?? "",
    order: ri.order,
  }));

  const parsedInserted = z.array(RecipeIngredientSelectWithNameSchema).safeParse(insertedWithNames);

  if (!parsedInserted.success) {
    dbLogger.error({ err: parsedInserted.error }, "Failed to parse inserted ingredients");
    throw new Error("Failed to parse inserted ingredients");
  }

  return parsedInserted.data;
}

/**
 * Ingredient Names written before names were folded, which the Pantry can
 * never match. The startup backfill works through them.
 */
export async function listIngredientNamesMissingNormalizedName(
  limit: number
): Promise<Array<{ id: string; name: string }>> {
  return await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(isNull(ingredients.normalizedName))
    .orderBy(asc(ingredients.id))
    .limit(limit);
}

/**
 * Store the folded form of each Ingredient Name. Rows that already carry one
 * are left alone, so two servers backfilling at once cannot undo each other.
 */
export async function setIngredientNormalizedNames(
  rows: ReadonlyArray<{ id: string; normalizedName: string }>
): Promise<void> {
  if (rows.length === 0) return;

  const ids = sql.join(
    rows.map((row) => sql`${row.id}`),
    sql`, `
  );
  const folded = sql.join(
    rows.map((row) => sql`${row.normalizedName}`),
    sql`, `
  );

  await db.execute(sql`
    UPDATE ${ingredients}
    SET normalized_name = folded.normalized_name
    FROM unnest(ARRAY[${ids}]::uuid[], ARRAY[${folded}]::text[]) AS folded(id, normalized_name)
    WHERE ${ingredients.id} = folded.id
      AND ${ingredients.normalizedName} IS NULL
  `);
}
