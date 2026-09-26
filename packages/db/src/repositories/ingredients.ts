import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import z from "zod";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { DbTransaction } from "@norish/db/drizzle";
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

/** The connection a caller is already inside, or the shared one. */
type Db = typeof db | DbTransaction;

const IngredientArraySchema = z.array(IngredientSelectBaseSchema);

/**
 * The columns a new Ingredient Name row is written with: the name and its
 * folded form, which is what the Pantry matches on (ADR-0036). Used by every
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

export async function findIngredientById(id: string): Promise<IngredientDto | null> {
  const rows = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1);
  const parsed = IngredientSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
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

/**
 * What the ingredient resolver answered for a recipe's line texts: each text
 * as written, and the alias and Ingredient it resolved to. The resolver lives
 * above this package, so a recipe write is handed its answers rather than
 * minting anything itself; every line's text must be here.
 */
export type IngredientResolutions = ReadonlyMap<string, { aliasId: string; ingredientId: string }>;

/**
 * The row values a recipe line is written with: its text as written, the
 * alias that text resolved to, and that alias's Ingredient. A line with no
 * text is not a line and is skipped.
 */
export function resolvedRecipeLineValues(
  ingredientName: string | undefined,
  resolutions: IngredientResolutions
): { name: string; ingredientAliasId: string; ingredientId: string } | null {
  if (!ingredientName) return null;

  const resolved = resolutions.get(ingredientName);

  if (!resolved) throw new Error(`Ingredient text was not resolved: ${ingredientName}`);

  return {
    name: ingredientName,
    ingredientAliasId: resolved.aliasId,
    ingredientId: resolved.ingredientId,
  };
}

export async function attachIngredientsToRecipeByInputTx(
  tx: any,
  payloadIngredients: RecipeIngredientInsertDto[],
  resolutions: IngredientResolutions
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

  const rows = items.flatMap((ri) => {
    const line = resolvedRecipeLineValues(ri.ingredientName, resolutions);

    if (!line) return [];

    return [
      {
        recipeId: ri.recipeId,
        ...line,
        amount: ri.amount != null ? Number(ri.amount) : null,
        unit: normalizeUnit(ri.unit ?? "", units), // ← Normalize unit to canonical ID
        order: ri.order,
        systemUsed: (ri.systemUsed as MeasurementSystem) || "metric",
      },
    ];
  });

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

  const insertedWithNames = inserted.map((ri: any) => ({
    ...ri,
    amount: ri.amount != null ? Number(ri.amount) : null,
    ingredientName: ri.name,
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
  rows: ReadonlyArray<{ id: string; normalizedName: string }>,
  tx: Db = db
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

  await tx.execute(sql`
    UPDATE ${ingredients}
    SET normalized_name = folded.normalized_name
    FROM unnest(ARRAY[${ids}]::uuid[], ARRAY[${folded}]::text[]) AS folded(id, normalized_name)
    WHERE ${ingredients.id} = folded.id
      AND ${ingredients.normalizedName} IS NULL
  `);
}

/**
 * The Ingredient Name with a fold on it. A name minted before names were
 * folded carries none, and a Pantry Ingredient whose name has no fold matches
 * nothing, so a reader that needs the fold now folds it now rather than
 * waiting for the next startup. Folding lives in this module and nowhere
 * else: on mint, in this repair, and in the batch the backfill drives.
 */
export async function ensureIngredientNameFolded(
  ingredient: IngredientDto,
  tx: Db = db
): Promise<IngredientDto> {
  if (ingredient.normalizedName !== null) return ingredient;

  const normalizedName = normalizeGroceryName(ingredient.name);

  await setIngredientNormalizedNames([{ id: ingredient.id, normalizedName }], tx);

  return { ...ingredient, normalizedName };
}
