import { eq } from "drizzle-orm";
import z from "zod";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
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
import { namesNoFood } from "@norish/shared/lib/ingredient-text";
import { normalizeUnit } from "@norish/shared/lib/unit-localization";

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

/**
 * What the ingredient resolver answered for a recipe's line texts: each text
 * as written, and the alias and Ingredient it resolved to. The resolver lives
 * above this package, so a recipe write is handed its answers rather than
 * minting anything itself; every line's text must be here.
 */
export type IngredientResolutions = ReadonlyMap<string, IngredientRef>;

/**
 * The row values a recipe line is written with: its text as written, the
 * alias that text resolved to, and that alias's Ingredient. A line with no
 * text is not a line and is skipped; one that names no food (a heading, a
 * text with no letter or digit) keeps no alias.
 */
export function resolvedRecipeLineValues(
  ingredientName: string | undefined,
  resolutions: IngredientResolutions
): { name: string; ingredientAliasId: string | null } | null {
  if (!ingredientName) return null;
  if (namesNoFood(ingredientName)) return { name: ingredientName, ingredientAliasId: null };

  const resolved = resolutions.get(ingredientName);

  if (!resolved) throw new Error(`Ingredient text was not resolved: ${ingredientName}`);

  return { name: ingredientName, ingredientAliasId: resolved.aliasId };
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
    ingredientId: resolutions.get(ri.name)?.ingredientId ?? null,
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
