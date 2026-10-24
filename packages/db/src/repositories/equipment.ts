import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import type { RecipeEquipmentInputDto } from "@norish/shared/contracts";
import type { IngredientSearch } from "@norish/shared/lib/ingredient-search";
import { db } from "@norish/db/drizzle";
import { equipment, equipmentAliases, recipeEquipment, recipes } from "@norish/db/schema";
import { foldName } from "@norish/shared/lib/fold-name";
import { stripHtmlTags } from "@norish/shared/lib/helpers";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";

import type { RecipeListContext } from "./recipes";
import { DEFAULT_EQUIPMENT } from "./equipment-defaults";
import { buildOwnerPolicyCondition } from "./recipes";

export interface CatalogueEquipmentAlias {
  id: string;
  text: string;
  ownerId: string | null;
  seeded: boolean;
  inUse: boolean;
}

export interface CatalogueEquipment {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string | null;
  version: number;
  aliases: CatalogueEquipmentAlias[];
}

export interface CatalogueEquipmentOwner {
  ownerId: string | null;
}

const aliasInUse = sql<boolean>`(exists (
  select 1 from ${recipeEquipment}
  where ${recipeEquipment.equipmentAliasId} = ${equipmentAliases}.${sql.identifier("id")}
))`;

export function cleanEquipmentText(text: string): string {
  return stripHtmlTags(text).replace(/\s+/g, " ").trim();
}

/**
 * Strip trailing parentheticals or comma notes ("Springform (26 cm)" -> "Springform",
 * "Frying pan, large" -> "Frying pan") so a recipe line with size/notes still
 * resolves to the base equipment item.
 */
export function stripEquipmentPreparation(text: string): string {
  const withoutParens = text.replace(/\([^()]*\)/g, " ").replace(/\[[^[\]]*\]/g, " ");
  const beforeComma = withoutParens.split(",")[0] ?? withoutParens;

  return beforeComma.replace(/\s+/g, " ").trim();
}

function matchingSearch(search: IngredientSearch): SQL | undefined {
  const matches = (value: SQL): SQL =>
    search.match === "exact"
      ? sql`${value} = ${search.fold}`
      : sql`${value} like ${search.pattern}`;
  const spellingOf = sql`exists (
    select 1 from ${equipmentAliases}
    where ${equipmentAliases.equipmentId} = ${equipment.id}
      and ${matches(sql`${equipmentAliases.fold}`)}
  )`;

  return or(matches(sql`lower(${equipment.name})`), spellingOf);
}

export async function listCatalogueEquipment(query: {
  search: IngredientSearch | null;
  id?: string;
  limit: number;
  offset: number;
}): Promise<CatalogueEquipment[]> {
  const matchesSearch = query.search ? matchingSearch(query.search) : undefined;
  const exactFirst = query.search
    ? [sql`case when lower(${equipment.name}) = ${query.search.fold} then 0 else 1 end`]
    : [];

  const rows = await db
    .select({
      id: equipment.id,
      name: equipment.name,
      icon: equipment.icon,
      ownerId: equipment.ownerId,
      version: equipment.version,
    })
    .from(equipment)
    .where(and(query.id === undefined ? undefined : eq(equipment.id, query.id), matchesSearch))
    .orderBy(...exactFirst, asc(sql`lower(${equipment.name})`), asc(equipment.id))
    .limit(query.limit)
    .offset(query.offset);

  if (rows.length === 0) return [];

  const aliases = await db
    .select({
      id: equipmentAliases.id,
      text: equipmentAliases.text,
      ownerId: equipmentAliases.ownerId,
      seeded: equipmentAliases.seeded,
      inUse: aliasInUse,
      equipmentId: equipmentAliases.equipmentId,
    })
    .from(equipmentAliases)
    .where(
      inArray(
        equipmentAliases.equipmentId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(equipmentAliases.createdAt), asc(equipmentAliases.id));

  return rows.map((row) => ({
    ...row,
    aliases: aliases
      .filter((alias) => alias.equipmentId === row.id)
      .map(({ equipmentId: _equipmentId, ...alias }) => alias),
  }));
}

export async function findEquipmentFor(
  text: string
): Promise<{ aliasId: string; equipmentId: string } | null> {
  const cleaned = cleanEquipmentText(text);

  if (!cleaned || namesNoFood(cleaned)) return null;

  const fold = foldName(cleaned);
  const bare = stripEquipmentPreparation(cleaned);
  const bareFold = foldName(bare);
  const folds = [...new Set([fold, bareFold].filter(Boolean))];

  if (folds.length === 0) return null;

  const rows = await db
    .select({
      aliasId: equipmentAliases.id,
      equipmentId: equipmentAliases.equipmentId,
      fold: equipmentAliases.fold,
    })
    .from(equipmentAliases)
    .where(inArray(equipmentAliases.fold, folds));

  const byFold = new Map(rows.map((r) => [r.fold, r]));
  const match = byFold.get(fold) ?? (bareFold ? byFold.get(bareFold) : undefined);

  return match ? { aliasId: match.aliasId, equipmentId: match.equipmentId } : null;
}

export async function findCatalogueEquipmentOwner(
  tx: DbTransaction | typeof db,
  id: string
): Promise<CatalogueEquipmentOwner | null> {
  const [row] = await tx
    .select({ ownerId: equipment.ownerId })
    .from(equipment)
    .where(eq(equipment.id, id))
    .limit(1);

  return row ?? null;
}

export async function findCatalogueEquipmentAliasOwner(
  tx: DbTransaction | typeof db,
  aliasId: string
): Promise<(CatalogueEquipmentOwner & { equipmentId: string; text: string }) | null> {
  const [row] = await tx
    .select({
      ownerId: equipmentAliases.ownerId,
      equipmentId: equipmentAliases.equipmentId,
      text: equipmentAliases.text,
    })
    .from(equipmentAliases)
    .where(eq(equipmentAliases.id, aliasId))
    .limit(1);

  return row ?? null;
}

export async function countEquipmentAliasesOf(
  tx: DbTransaction | typeof db,
  equipmentId: string
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(equipmentAliases)
    .where(eq(equipmentAliases.equipmentId, equipmentId));

  return row?.count ?? 0;
}

export async function findEquipmentIdByFold(
  tx: DbTransaction | typeof db,
  fold: string
): Promise<string | null> {
  const [row] = await tx
    .select({ equipmentId: equipmentAliases.equipmentId })
    .from(equipmentAliases)
    .where(eq(equipmentAliases.fold, fold))
    .limit(1);

  return row?.equipmentId ?? null;
}

export async function insertCatalogueEquipment(
  tx: DbTransaction | typeof db,
  input: { name: string; ownerId: string | null; icon?: string | null }
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(equipment)
    .values({
      name: input.name,
      ownerId: input.ownerId,
      icon: input.icon ?? null,
    })
    .returning({ id: equipment.id });

  if (!row) throw new Error("Failed to insert equipment");

  return row;
}

export async function renameCatalogueEquipment(
  tx: DbTransaction | typeof db,
  id: string,
  name: string
): Promise<{ id: string } | null> {
  const [row] = await tx
    .update(equipment)
    .set({
      name,
      version: sql`${equipment.version} + 1`,
    })
    .where(eq(equipment.id, id))
    .returning({ id: equipment.id });

  return row ?? null;
}

export async function insertCatalogueEquipmentAlias(
  tx: DbTransaction | typeof db,
  input: {
    equipmentId: string;
    text: string;
    fold: string;
    ownerId: string | null;
    seeded?: boolean;
  }
): Promise<{ id: string; text: string; ownerId: string | null } | null> {
  const [row] = await tx
    .insert(equipmentAliases)
    .values({
      equipmentId: input.equipmentId,
      text: input.text,
      fold: input.fold,
      ownerId: input.ownerId,
      seeded: input.seeded ?? false,
    })
    .onConflictDoNothing()
    .returning({
      id: equipmentAliases.id,
      text: equipmentAliases.text,
      ownerId: equipmentAliases.ownerId,
    });

  return row ?? null;
}

export async function isEquipmentAliasInUse(
  tx: DbTransaction | typeof db,
  aliasId: string
): Promise<boolean> {
  const rows = await tx
    .select({ one: sql`1` })
    .from(recipeEquipment)
    .where(eq(recipeEquipment.equipmentAliasId, aliasId))
    .limit(1);

  return rows.length > 0;
}

export async function deleteCatalogueEquipmentAlias(
  tx: DbTransaction | typeof db,
  aliasId: string
): Promise<void> {
  await tx.delete(equipmentAliases).where(eq(equipmentAliases.id, aliasId));
}

export async function isEquipmentInUse(
  tx: DbTransaction | typeof db,
  id: string
): Promise<boolean> {
  const rows = await tx
    .select({ one: sql`1` })
    .from(recipeEquipment)
    .innerJoin(equipmentAliases, eq(equipmentAliases.id, recipeEquipment.equipmentAliasId))
    .where(eq(equipmentAliases.equipmentId, id))
    .limit(1);

  return rows.length > 0;
}

export async function deleteCatalogueEquipment(
  tx: DbTransaction | typeof db,
  id: string
): Promise<void> {
  await tx.delete(equipment).where(eq(equipment.id, id));
}

export async function mergeCatalogueEquipment(
  tx: DbTransaction,
  sourceId: string,
  targetId: string
): Promise<boolean> {
  const locked = await tx
    .select({ id: equipment.id, name: equipment.name })
    .from(equipment)
    .where(inArray(equipment.id, [sourceId, targetId]))
    .orderBy(asc(equipment.id))
    .for("update");

  if (locked.length < 2) return false;
  const source = locked.find((row) => row.id === sourceId);

  await tx
    .update(equipmentAliases)
    .set({ equipmentId: targetId, updatedAt: new Date() })
    .where(eq(equipmentAliases.equipmentId, sourceId));

  if (source) {
    const cleaned = cleanEquipmentText(source.name);
    const fold = foldName(cleaned);

    if (cleaned && fold) {
      await insertCatalogueEquipmentAlias(tx, {
        equipmentId: targetId,
        text: cleaned,
        fold,
        ownerId: null,
      });
    }
  }

  const [gone] = await tx
    .delete(equipment)
    .where(eq(equipment.id, sourceId))
    .returning({ icon: equipment.icon });

  await tx.execute(sql`
    update ${equipment}
    set version = version + 1,
        icon = coalesce(icon, ${gone?.icon ?? null})
    where id = ${targetId}
  `);

  return true;
}

export async function setCatalogueEquipmentIcon(
  tx: DbTransaction | typeof db,
  id: string,
  icon: string | null
): Promise<boolean> {
  const updated = await tx
    .update(equipment)
    .set({ icon, version: sql`${equipment.version} + 1` })
    .where(eq(equipment.id, id))
    .returning({ id: equipment.id });

  return updated.length > 0;
}

export async function findEquipmentIcons(
  ids: readonly string[]
): Promise<Map<string, string | null>> {
  const wanted = [...new Set(ids)];

  if (wanted.length === 0) return new Map();

  const rows = await db
    .select({ id: equipment.id, icon: equipment.icon })
    .from(equipment)
    .where(inArray(equipment.id, wanted));

  return new Map(rows.map((row) => [row.id, row.icon]));
}

export interface EquipmentUses {
  recipes: Array<{ id: string; name: string }>;
  elsewhere: number;
}

export async function listEquipmentUses(
  viewer: RecipeListContext,
  equipmentId: string
): Promise<EquipmentUses> {
  const spellings = db
    .select({ id: equipmentAliases.id })
    .from(equipmentAliases)
    .where(eq(equipmentAliases.equipmentId, equipmentId));
  const openable = (await buildOwnerPolicyCondition(viewer, recipes.userId, "view")) ?? sql`true`;

  const lines = await db
    .select({ id: recipes.id, name: recipes.name, visible: sql<boolean>`${openable}` })
    .from(recipeEquipment)
    .innerJoin(recipes, eq(recipes.id, recipeEquipment.recipeId))
    .where(inArray(recipeEquipment.equipmentAliasId, spellings))
    .orderBy(asc(sql`lower(${recipes.name})`));

  const openRecipes = new Map(lines.filter((line) => line.visible).map((line) => [line.id, line]));

  return {
    recipes: [...openRecipes.values()].map(({ id, name }) => ({ id, name })),
    elsewhere: lines.filter((row) => !row.visible).length,
  };
}

/**
 * Resolve a recipe equipment line's text to an `equipment_aliases` id inside a
 * transaction, minting a new `equipment` + `equipment_aliases` entry if unknown.
 */
async function resolveEquipmentLineTx(
  tx: any,
  rawText: string,
  userId: string | null | undefined
): Promise<{ name: string; equipmentAliasId: string | null } | null> {
  const name = cleanEquipmentText(rawText);

  if (!name) return null;
  if (namesNoFood(name)) return { name, equipmentAliasId: null };

  const fold = foldName(name);
  const bare = stripEquipmentPreparation(name);
  const bareFold = foldName(bare);
  const folds = [...new Set([fold, bareFold].filter(Boolean))];

  if (folds.length === 0) return { name, equipmentAliasId: null };

  const existingAliases = await tx
    .select({
      id: equipmentAliases.id,
      fold: equipmentAliases.fold,
    })
    .from(equipmentAliases)
    .where(inArray(equipmentAliases.fold, folds));

  const byFold = new Map<string, string>(
    existingAliases.map((row: { id: string; fold: string }) => [row.fold, row.id])
  );
  const matchedAliasId = byFold.get(fold) ?? (bareFold ? byFold.get(bareFold) : undefined);

  if (matchedAliasId) {
    return { name, equipmentAliasId: matchedAliasId };
  }

  const canonicalName = bare || name;
  const canonicalFold = bareFold || fold;

  // Check if an equipment row with this name already exists
  const [existingEquip] = await tx
    .select({ id: equipment.id })
    .from(equipment)
    .where(eq(sql`lower(${equipment.name})`, canonicalName.toLowerCase()))
    .limit(1);

  let equipmentId: string | undefined = existingEquip?.id;

  if (!equipmentId) {
    const [createdEquip] = await tx
      .insert(equipment)
      .values({
        name: canonicalName,
        ownerId: userId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: equipment.id });

    if (createdEquip) {
      equipmentId = createdEquip.id;
    } else {
      const [found] = await tx
        .select({ id: equipment.id })
        .from(equipment)
        .where(eq(sql`lower(${equipment.name})`, canonicalName.toLowerCase()))
        .limit(1);

      equipmentId = found?.id;
    }
  }

  if (!equipmentId) return { name, equipmentAliasId: null };

  const [insertedAlias] = await tx
    .insert(equipmentAliases)
    .values({
      equipmentId,
      text: canonicalName,
      fold: canonicalFold,
      ownerId: userId ?? null,
      seeded: false,
    })
    .onConflictDoNothing()
    .returning({ id: equipmentAliases.id });

  if (insertedAlias) {
    return { name, equipmentAliasId: insertedAlias.id };
  }

  const [fallbackAlias] = await tx
    .select({ id: equipmentAliases.id })
    .from(equipmentAliases)
    .where(eq(equipmentAliases.fold, canonicalFold))
    .limit(1);

  return { name, equipmentAliasId: fallbackAlias?.id ?? null };
}

/**
 * Sync a recipe's equipment lines inside a transaction, preserving existing row
 * IDs where provided and resolving each line's text to an Equipment Alias.
 */
export async function syncRecipeEquipmentTx(
  tx: any,
  recipeId: string,
  userId: string | null | undefined,
  inputs: readonly RecipeEquipmentInputDto[]
): Promise<void> {
  const existing = await tx
    .select({ id: recipeEquipment.id })
    .from(recipeEquipment)
    .where(eq(recipeEquipment.recipeId, recipeId));
  const existingById = new Map(existing.map((row: { id: string }) => [row.id, row]));
  const retainedIds = new Set<string>();

  for (const [index, item] of inputs.entries()) {
    const line = await resolveEquipmentLineTx(tx, item.name, userId);

    if (!line) continue;

    const values = {
      ...line,
      order: item.order ?? index,
      updatedAt: new Date(),
    };

    if (item.id && existingById.has(item.id)) {
      retainedIds.add(item.id);
      await tx
        .update(recipeEquipment)
        .set({ ...values, version: sql`${recipeEquipment.version} + 1` })
        .where(eq(recipeEquipment.id, item.id));
      continue;
    }

    await tx.insert(recipeEquipment).values({
      recipeId,
      ...values,
    });
  }

  const idsToDelete = existing
    .map((row: { id: string }) => row.id)
    .filter((id: string) => !retainedIds.has(id));

  if (idsToDelete.length > 0) {
    await tx.delete(recipeEquipment).where(inArray(recipeEquipment.id, idsToDelete));
  }
}

/**
 * Seeds default equipment and their aliases into the database if missing.
 */
export async function seedDefaultEquipment(): Promise<void> {
  await db.transaction(async (tx) => {
    // Ensure schema is up-to-date even if an earlier dev preview migration ran
    await tx.execute(sql`DROP TABLE IF EXISTS "equipment_translations" CASCADE`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS "equipment_aliases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "text" text NOT NULL,
        "fold" text NOT NULL,
        "equipment_id" uuid NOT NULL REFERENCES "public"."equipment"("id") ON DELETE cascade,
        "owner_id" text REFERENCES "public"."user"("id") ON DELETE set null,
        "seeded" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "version" integer DEFAULT 1 NOT NULL
      )
    `);
    await tx.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "uqidx_equipment_aliases_fold" ON "equipment_aliases" USING btree ("fold")
    `);
    await tx.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_equipment_aliases_equipment_id" ON "equipment_aliases" USING btree ("equipment_id")
    `);

    // Upgrade recipe_equipment if it lacks the `name` column from an earlier dev run
    await tx.execute(sql`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'recipe_equipment' AND column_name = 'equipment_id'
        ) THEN
          DROP TABLE "recipe_equipment" CASCADE;
        END IF;
      END $$;
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS "recipe_equipment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "recipe_id" uuid NOT NULL REFERENCES "public"."recipes"("id") ON DELETE cascade,
        "name" text NOT NULL,
        "equipment_alias_id" uuid REFERENCES "public"."equipment_aliases"("id"),
        "order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "version" integer DEFAULT 1 NOT NULL
      )
    `);
    await tx.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_recipe_equipment_recipe_id" ON "recipe_equipment" USING btree ("recipe_id")
    `);
    await tx.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_recipe_equipment_equipment_alias_id" ON "recipe_equipment" USING btree ("equipment_alias_id")
    `);

    // Clear legacy non-file icon slugs from the earlier preview if present
    await tx.execute(sql`
      UPDATE "equipment" SET "icon" = NULL WHERE "icon" IS NOT NULL AND "icon" NOT LIKE '%.webp'
    `);

    for (const item of DEFAULT_EQUIPMENT) {
      const [inserted] = await tx
        .insert(equipment)
        .values({
          id: item.id,
          name: item.name,
          icon: null,
          ownerId: null,
        })
        .onConflictDoNothing()
        .returning({ id: equipment.id });

      let equipId = inserted?.id;

      if (!equipId) {
        const [existing] = await tx
          .select({ id: equipment.id })
          .from(equipment)
          .where(eq(sql`lower(${equipment.name})`, item.name.toLowerCase()))
          .limit(1);

        equipId = existing?.id;
      }

      if (!equipId) continue;

      const seenFolds = new Set<string>();
      const aliasRows: Array<{
        equipmentId: string;
        text: string;
        fold: string;
        ownerId: null;
        seeded: true;
      }> = [];

      for (const rawAlias of [item.name, ...item.aliases]) {
        const cleaned = cleanEquipmentText(rawAlias);
        const fold = foldName(cleaned);

        if (!cleaned || !fold || seenFolds.has(fold)) continue;
        seenFolds.add(fold);
        aliasRows.push({
          equipmentId: equipId,
          text: cleaned,
          fold,
          ownerId: null,
          seeded: true,
        });
      }

      if (aliasRows.length > 0) {
        await tx.insert(equipmentAliases).values(aliasRows).onConflictDoNothing();
      }
    }
  });
}
