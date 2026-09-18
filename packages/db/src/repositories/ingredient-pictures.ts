/**
 * Ingredient Illustrations, which live on the Ingredient Names themselves
 * (ADR-0037).
 *
 * Only an administrator writes here. An Ingredient Illustration belongs to the
 * Ingredient Name it was drawn for and to nothing else — a line shows its own
 * ingredient's picture, never one borrowed by a matching name at read time.
 *
 * Every read and write of these columns is issued from this module, so no
 * router, worker, or startup job composes its own query.
 */

import type { SQL } from "drizzle-orm";
import { and, asc, eq, ilike, isNull, ne, sql } from "drizzle-orm";

import type {
  AdminIngredientDto,
  AdminIngredientListInput,
  IngredientDetailsCreateDto,
  IngredientDetailsUpdateDto,
  IngredientSummaryDto,
} from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { ingredients, pantryIngredients, recipeIngredients } from "@norish/db/schema";
import {
  AdminIngredientListInputSchema,
  IngredientDetailsCreateSchema,
  IngredientDetailsUpdateSchema,
} from "@norish/shared/contracts/zod";
import { stripHtmlTags } from "@norish/shared/lib/helpers";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

/** The outcome of an administrator's write to one Ingredient Name. */
export type IngredientDetailsWriteResult =
  | { status: "ok"; ingredient: AdminIngredientDto }
  /** The name already belongs to another Ingredient Name. */
  | { status: "duplicate"; name: string; ownerName: string }
  /** A name is nothing once folded (e.g. only punctuation). */
  | { status: "invalid-name"; name: string }
  | { status: "not-found" }
  /** The row changed since the administrator loaded it. */
  | { status: "stale" };

export type IngredientDeleteResult =
  | { status: "ok" }
  /**
   * Recipes use the name, or a household has it in its Pantry; deleting it
   * would delete their rows with it.
   */
  | { status: "in-use"; recipeCount: number; pantryCount: number }
  | { status: "not-found" };

interface CleanDetails {
  name: string;
  normalizedName: string;
}

function cleanName(name: string): string {
  return stripHtmlTags(name).trim();
}

/** The name an administrator submitted, cleaned and folded. */
function cleanDetails(input: { name: string }): CleanDetails | { invalid: string } {
  const name = cleanName(input.name);
  const normalizedName = normalizeGroceryName(name);

  if (!normalizedName) return { invalid: input.name };

  return { name, normalizedName };
}

/**
 * The columns an administrator's row is read with. Built on call, not at
 * module load, so a test that mocks the schema can still import a module that
 * imports this one.
 */
function adminColumns() {
  return {
    id: ingredients.id,
    name: ingredients.name,
    imageUrl: ingredients.imageUrl,
    version: ingredients.version,
    // Qualified by hand: drizzle drops table names from columns in a single-table select.
    recipeCount: sql<number>`(
      SELECT count(DISTINCT ri.recipe_id)::int FROM recipe_ingredients ri
      WHERE ri.ingredient_id = "ingredients"."id"
    )`,
  };
}

function byName() {
  return [asc(sql`lower(${ingredients.name})`), asc(ingredients.id)];
}

/** One page of every Ingredient Name, for administration. */
export async function listIngredientsForAdmin(
  input: AdminIngredientListInput = {}
): Promise<{ items: AdminIngredientDto[]; nextCursor: number | null }> {
  const { search, cursor = 0, limit } = AdminIngredientListInputSchema.parse(input);
  const conditions: SQL[] = [];

  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

    conditions.push(ilike(ingredients.name, pattern));
  }

  const rows = await db
    .select(adminColumns())
    .from(ingredients)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...byName())
    .limit(limit + 1)
    .offset(cursor);

  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? cursor + limit : null,
  };
}

export async function findIngredientForAdmin(id: string): Promise<AdminIngredientDto | null> {
  const [row] = await db.select(adminColumns()).from(ingredients).where(eq(ingredients.id, id));

  return row ?? null;
}

/**
 * Every Ingredient Name, as a device needs it: to show the picture a name
 * matches, and to suggest names in the recipe editor. Suggestions cover every
 * name recipes use, not only the ones an administrator has reached yet, so the
 * editor offers the same names whether or not a picture exists.
 */
export async function listIngredientNames(): Promise<IngredientSummaryDto[]> {
  return await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      imageUrl: ingredients.imageUrl,
    })
    .from(ingredients)
    .orderBy(...byName());
}

/**
 * The Ingredient Name that already holds this name, case-insensitively. Names
 * are unique that way, and a rename onto a name another row already has is
 * refused rather than silently merging the two.
 */
async function findDuplicateName(
  details: CleanDetails,
  exceptId: string | null
): Promise<{ ownerName: string } | null> {
  const others = exceptId ? ne(ingredients.id, exceptId) : undefined;

  const [sameName] = await db
    .select({ name: ingredients.name })
    .from(ingredients)
    .where(and(eq(sql`lower(${ingredients.name})`, details.name.toLowerCase()), others))
    .limit(1);

  return sameName ? { ownerName: sameName.name } : null;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  while (current && typeof current === "object") {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

async function okOrMissing(id: string): Promise<IngredientDetailsWriteResult> {
  const ingredient = await findIngredientForAdmin(id);

  return ingredient ? { status: "ok", ingredient } : { status: "not-found" };
}

/** Add an Ingredient Name no recipe uses yet, so it can be given a picture ahead of time. */
export async function createIngredientWithDetails(
  input: IngredientDetailsCreateDto
): Promise<IngredientDetailsWriteResult> {
  const details = cleanDetails(IngredientDetailsCreateSchema.parse(input));

  if ("invalid" in details) return { status: "invalid-name", name: details.invalid };

  const clash = await findDuplicateName(details, null);

  if (clash) return duplicate(details, clash.ownerName);

  try {
    const [row] = await db.insert(ingredients).values(details).returning({ id: ingredients.id });

    if (!row) throw new Error("Failed to create ingredient");

    return await okOrMissing(row.id);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const raced = await findDuplicateName(details, null);

    return duplicate(details, raced?.ownerName ?? details.name);
  }
}

function duplicate(details: CleanDetails, ownerName: string): IngredientDetailsWriteResult {
  return { status: "duplicate", name: details.name, ownerName };
}

/**
 * Rename an Ingredient Name. A rename changes the text of every recipe line
 * that uses the name.
 */
export async function updateIngredientDetails(
  input: IngredientDetailsUpdateDto
): Promise<IngredientDetailsWriteResult> {
  const parsed = IngredientDetailsUpdateSchema.parse(input);
  const details = cleanDetails(parsed);

  if ("invalid" in details) return { status: "invalid-name", name: details.invalid };

  const clash = await findDuplicateName(details, parsed.id);

  if (clash) return duplicate(details, clash.ownerName);

  try {
    const [row] = await db
      .update(ingredients)
      .set({ ...details, version: sql`${ingredients.version} + 1` })
      .where(and(eq(ingredients.id, parsed.id), eq(ingredients.version, parsed.version)))
      .returning({ id: ingredients.id });

    if (!row) {
      const [exists] = await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.id, parsed.id));

      return { status: exists ? "stale" : "not-found" };
    }

    return await okOrMissing(row.id);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const raced = await findDuplicateName(details, parsed.id);

    return duplicate(details, raced?.ownerName ?? details.name);
  }
}

/**
 * Delete an Ingredient Name that nothing points at. A name a recipe line uses,
 * or a name a household keeps in its Pantry, is refused: the foreign key would
 * take those rows with it, and neither is an administrator's to discard.
 */
export async function deleteIngredientIfUnused(id: string): Promise<IngredientDeleteResult> {
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .for("update");

    if (!row) return { status: "not-found" };

    const countRecipes = async () => {
      const [usage] = await tx
        .select({ count: sql<number>`count(DISTINCT ${recipeIngredients.recipeId})::int` })
        .from(recipeIngredients)
        .where(eq(recipeIngredients.ingredientId, id));

      return usage?.count ?? 0;
    };

    const countPantries = async () => {
      const [usage] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(pantryIngredients)
        .where(eq(pantryIngredients.ingredientId, id));

      return usage?.count ?? 0;
    };

    const inUse = async () => ({
      status: "in-use" as const,
      recipeCount: await countRecipes(),
      pantryCount: await countPantries(),
    });

    const before = await inUse();

    if (before.recipeCount > 0 || before.pantryCount > 0) return before;

    const [deleted] = await tx
      .delete(ingredients)
      .where(
        and(
          eq(ingredients.id, id),
          sql`NOT EXISTS (SELECT 1 FROM ${recipeIngredients} WHERE ${recipeIngredients.ingredientId} = ${id})`,
          sql`NOT EXISTS (SELECT 1 FROM ${pantryIngredients} WHERE ${pantryIngredients.ingredientId} = ${id})`
        )
      )
      .returning({ id: ingredients.id });

    // Something claimed the name between the count and the delete: say what
    // does now rather than inventing a number.
    return deleted ? { status: "ok" } : await inUse();
  });
}

/**
 * Set or clear an Ingredient Name's picture.
 *
 * The version is left alone: it guards the names an administrator edits as a
 * draft, while a picture is written whole the moment it is chosen. Bumping it
 * would make the editor that just uploaded a picture refuse its own next save.
 *
 * @returns the picture it replaced (null when it had none), or undefined when
 *   the name no longer exists — a generation finishing after a delete
 */
export async function setIngredientImage(
  id: string,
  imageUrl: string | null
): Promise<{ previousImageUrl: string | null } | undefined> {
  return await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ imageUrl: ingredients.imageUrl })
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .for("update");

    if (!before) return undefined;

    await tx.update(ingredients).set({ imageUrl }).where(eq(ingredients.id, id));

    return { previousImageUrl: before.imageUrl };
  });
}

/**
 * The Ingredient Names worth drawing in a "generate missing pictures" run:
 * those without a picture that a recipe uses. Names nothing uses any more are
 * not billed for.
 */
function missingImage() {
  return and(
    isNull(ingredients.imageUrl),
    sql`EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.ingredient_id = "ingredients"."id")`
  );
}

export async function listIngredientIdsMissingImage(): Promise<string[]> {
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(missingImage())
    .orderBy(...byName());

  return rows.map((row) => row.id);
}

/** How many names are worth drawing, for the count an administrator is shown first. */
export async function countIngredientsMissingImage(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ingredients)
    .where(missingImage());

  return row?.count ?? 0;
}
