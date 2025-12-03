import type { IngredientDto } from "@/types/dto/ingredient";
import type {
  RecipeIngredientInsertDto,
  RecipeIngredientsDto,
} from "@/types/dto/recipe-ingredient";

import { eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import { db } from "@/server/db/drizzle";
import { ingredients, recipeIngredients } from "@/server/db/schema";
import { IngredientSelectBaseSchema } from "@/server/db/zodSchemas";
import {
  RecipeIngredientInputSchema,
  RecipeIngredientSelectWithNameSchema,
  RecipeIngredientsInsertBaseSchema,
} from "@/server/db/zodSchemas/recipe-ingredients";
import { MeasurementSystem } from "@/types";
import { dbLogger } from "@/server/logger";
import { stripHtmlTags } from "@/lib/helpers";

const IngredientArraySchema = z.array(IngredientSelectBaseSchema);

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

  await db.insert(ingredients).values({ name: cleaned }).onConflictDoNothing();

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
    await tx
      .insert(ingredients)
      .values(cleaned.map((name) => ({ name })))
      .onConflictDoNothing();

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

  await tx
    .insert(ingredients)
    .values(cleaned.map((name: string) => ({ name })))
    .onConflictDoNothing();

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

  const names = Array.from(
    new Set(items.map((ri) => ri.ingredientName?.trim() ?? "").filter(Boolean))
  );
  const ingredients = names.length > 0 ? await getOrCreateManyIngredientsTx(tx, names) : [];

  if (!ingredients.length) return [];

  const rows = items
    .map((ri) => {
      const ing =
        ingredients.find(
          (i) => i.name.toLowerCase().trim() === ri.ingredientName?.toLowerCase().trim()
        ) ??
        ingredients.find((i) =>
          i.name.toLowerCase().includes(ri.ingredientName?.toLowerCase().trim() ?? "")
        );

      if (!ing) return null;

      return {
        recipeId: ri.recipeId,
        ingredientId: ing.id,
        amount: ri.amount != null ? Number(ri.amount) : null,
        unit: ri.unit ?? "",
        order: ri.order,
        systemUsed: (ri.systemUsed as MeasurementSystem) || "metric",
      };
    })
    .filter(Boolean);

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
    ingredientName: ingredients.find((i) => i.id === ri.ingredientId)?.name ?? "",
    order: ri.order,
  }));

  const parsedInserted = z.array(RecipeIngredientSelectWithNameSchema).safeParse(insertedWithNames);

  if (!parsedInserted.success) {
    dbLogger.error({ err: parsedInserted.error }, "Failed to parse inserted ingredients");
    throw new Error("Failed to parse inserted ingredients");
  }

  return parsedInserted.data;
}
