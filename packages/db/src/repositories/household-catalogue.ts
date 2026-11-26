/**
 * The catalogue side of a membership move (ADR-0042): a leaver's recipes carry copies of the
 * household foods their lines use; a household of one joining merges its catalogue in.
 */
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { DbTransaction } from "@norish/db/drizzle";
import type { FoodTargets } from "@norish/shared/lib/recipe-nutrition";
import {
  ingredientAIChanges,
  ingredientAliases,
  ingredientJunkPile,
  ingredientNutritionCorrections,
  ingredientNutritionEstimates,
  ingredients,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
} from "@norish/db/schema";

import { isAnyOf, pickedByKey } from "./array-params";
import { clearAIFlagUnlessOpen, followJoinTargetsTx } from "./ingredient-ai-changes";
import { deleteCatalogueAlias } from "./ingredient-catalogue";
import {
  findIngredientAncestors,
  lockIngredients,
  lockTree,
  mergeLockedFoods,
  sameFoodName,
} from "./ingredient-relocation";
import { lockUntilSettled } from "./lock-until-settled";
import { defaultOf } from "./raw-sql";
import { rekeyNutritionSharesTx } from "./recipe-enrichment";

const qb = new QueryBuilder();

/** A food or spelling row as these conditions read it, from any alias of its table. */
type Owned = { id: AnyPgColumn; householdId: AnyPgColumn };

/** `food` is `householdId`'s food of `other`'s name: where a moved food lands. */
const namedIn = (
  food: { householdId: AnyPgColumn; name: AnyPgColumn },
  householdId: string,
  other: { name: AnyPgColumn }
) => and(eq(food.householdId, householdId), sameFoodName(food.name, other.name));

/** `spelling` is `householdId`'s spelling of `other`'s fold. */
const foldedIn = (
  spelling: { householdId: AnyPgColumn; fold: AnyPgColumn },
  householdId: string,
  other: { fold: AnyPgColumn }
) => and(eq(spelling.householdId, householdId), eq(spelling.fold, other.fold));

/** The foods of `householdId` named as each of these foods: where each would land there. */
async function foodsNamedIn(
  tx: DbTransaction,
  householdId: string,
  which: (food: Owned) => SQL | undefined
): Promise<Map<string, string>> {
  const food = alias(ingredients, "moved_food");
  const named = alias(ingredients, "named_food");
  const rows = await tx
    .select({ from: food.id, to: named.id })
    .from(food)
    .innerJoin(named, namedIn(named, householdId, food))
    .where(which(food));

  return new Map(rows.map((row) => [row.from, row.to]));
}

/**
 * After a leave (ADR-0042): no line of the household's recipes names another household's food or
 * spelling. Each such food is copied (name, flags, icon file, AI estimate; its parent where seeded or
 * copied too) with the spellings the lines use, a spelling on a seeded food becomes the household's,
 * and the lines and their AI shares follow. The old rows are held against a change until the commit.
 */
export async function carryRecipeFoodsTx(tx: DbTransaction, householdId: string): Promise<void> {
  const leaverLines = qb
    .select({ id: recipeIngredients.id })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .where(eq(recipes.householdId, householdId));
  const foreign = (column: typeof ingredients.householdId | typeof ingredientAliases.householdId) =>
    and(isNotNull(column), ne(column, householdId));
  // Foods before spellings, as a deletion takes them: a rename, merge or delete waits for the move.
  const lineSpellings = await lockUntilSettled(
    () =>
      tx
        .selectDistinct({ id: ingredientAliases.id, foodId: ingredientAliases.ingredientId })
        .from(ingredientAliases)
        .innerJoin(
          recipeIngredientFoods,
          eq(recipeIngredientFoods.ingredientAliasId, ingredientAliases.id)
        )
        .where(
          and(
            inArray(recipeIngredientFoods.recipeIngredientId, leaverLines),
            foreign(ingredientAliases.householdId)
          )
        ),
    async (rows) => {
      await tx
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(
          and(
            isAnyOf(
              ingredients.id,
              rows.map((row) => row.foodId),
              "uuid"
            ),
            foreign(ingredients.householdId)
          )
        )
        .orderBy(ingredients.id)
        .for("share");
      await tx
        .select({ id: ingredientAliases.id })
        .from(ingredientAliases)
        .where(
          isAnyOf(
            ingredientAliases.id,
            rows.map((row) => row.id),
            "uuid"
          )
        )
        .orderBy(ingredientAliases.id)
        .for("share");
    },
    (row) => `${row.id} ${row.foodId}`
  );

  if (lineSpellings.length === 0) return;
  const spellingIds = lineSpellings.map((row) => row.id);
  const foreignFoods = (
    await tx
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(
        and(
          isAnyOf(
            ingredients.id,
            lineSpellings.map((row) => row.foodId),
            "uuid"
          ),
          foreign(ingredients.householdId)
        )
      )
  ).map((row) => row.id);
  const old = alias(ingredients, "old_food");
  const copy = alias(ingredients, "copy_food");
  const sameName = namedIn(copy, householdId, old);
  const made = await tx
    .insert(ingredients)
    .select(
      qb
        .select({
          id: defaultOf(ingredients.id),
          householdId: sql<string>`${householdId}::uuid`.as(ingredients.householdId.name),
          name: old.name,
          ownerId: sql<string | null>`null`.as(ingredients.ownerId.name),
          addedByHand: old.addedByHand,
          flagged: old.flagged,
          flagReason: old.flagReason,
          keptDistinct: old.keptDistinct,
          parentId: sql<string | null>`null::uuid`.as(ingredients.parentId.name),
          parentChosen: old.parentChosen,
          offId: old.offId,
          nutritionCodes: old.nutritionCodes,
          icon: old.icon,
          nameSettled: old.nameSettled,
          nameChosen: old.nameChosen,
          unusedSince: sql<Date | null>`null::timestamptz`.as(ingredients.unusedSince.name),
          createdAt: defaultOf(ingredients.createdAt),
          version: defaultOf(ingredients.version),
        })
        .from(old)
        .where(isAnyOf(old.id, foreignFoods, "uuid"))
    )
    .onConflictDoNothing()
    .returning({ id: ingredients.id });
  const madeIds = made.map((row) => row.id);
  const copies: FoodTargets = await foodsNamedIn(tx, householdId, (food) =>
    isAnyOf(food.id, foreignFoods, "uuid")
  );
  const parent = alias(ingredients, "old_parent");
  const parentCopy = alias(ingredients, "copy_parent");

  // A seeded parent stays; an own one only as its copy, where the lines use it too.
  await tx
    .update(copy)
    .set({ parentId: sql`${old.parentId}` })
    .from(old)
    .innerJoin(parent, eq(parent.id, old.parentId))
    .where(and(sameName, isAnyOf(copy.id, madeIds, "uuid"), isNull(parent.householdId)));
  await tx
    .update(copy)
    .set({ parentId: sql`${parentCopy.id}` })
    .from(old)
    .innerJoin(parent, eq(parent.id, old.parentId))
    .innerJoin(parentCopy, namedIn(parentCopy, householdId, parent))
    .where(
      and(sameName, isAnyOf(copy.id, madeIds, "uuid"), isAnyOf(parent.id, foreignFoods, "uuid"))
    );
  await fileUnderSeededAncestorTx(tx, foreignFoods, copies, new Set(madeIds));
  await tx
    .insert(ingredientNutritionEstimates)
    .select(
      qb
        .select({
          ingredientId: sql<string>`${copy.id}`.as(ingredientNutritionEstimates.ingredientId.name),
          kcal: ingredientNutritionEstimates.kcal,
          fat: ingredientNutritionEstimates.fat,
          carbs: ingredientNutritionEstimates.carbs,
          protein: ingredientNutritionEstimates.protein,
          pieceWeight: ingredientNutritionEstimates.pieceWeight,
          pieceless: ingredientNutritionEstimates.pieceless,
          density: ingredientNutritionEstimates.density,
          createdAt: ingredientNutritionEstimates.createdAt,
          updatedAt: ingredientNutritionEstimates.updatedAt,
          version: ingredientNutritionEstimates.version,
        })
        .from(ingredientNutritionEstimates)
        .innerJoin(old, eq(old.id, ingredientNutritionEstimates.ingredientId))
        .innerJoin(copy, sameName)
        .where(isAnyOf(copy.id, madeIds, "uuid"))
    )
    .onConflictDoNothing();

  const spelling = alias(ingredientAliases, "old_spelling");
  const copySpelling = alias(ingredientAliases, "copy_spelling");
  const spellingRow = (ingredientId: SQL) => ({
    id: defaultOf(ingredientAliases.id),
    householdId: sql<string>`${householdId}::uuid`.as(ingredientAliases.householdId.name),
    text: spelling.text,
    fold: spelling.fold,
    locale: spelling.locale,
    ingredientId: sql<string>`${ingredientId}`.as(ingredientAliases.ingredientId.name),
    ownerId: sql<string | null>`null`.as(ingredientAliases.ownerId.name),
    seeded: defaultOf(ingredientAliases.seeded),
    createdAt: defaultOf(ingredientAliases.createdAt),
    updatedAt: defaultOf(ingredientAliases.updatedAt),
    version: defaultOf(ingredientAliases.version),
  });

  // A spelling on a seeded food stays on it, as the household's; one on an own food goes to the copy.
  await tx
    .insert(ingredientAliases)
    .select(
      qb
        .select(spellingRow(sql`${spelling.ingredientId}`))
        .from(spelling)
        .innerJoin(old, eq(old.id, spelling.ingredientId))
        .where(and(isAnyOf(spelling.id, spellingIds, "uuid"), isNull(old.householdId)))
    )
    .onConflictDoNothing();
  await tx
    .insert(ingredientAliases)
    .select(
      qb
        .select(spellingRow(sql`${copy.id}`))
        .from(spelling)
        .innerJoin(old, eq(old.id, spelling.ingredientId))
        .innerJoin(copy, sameName)
        .where(isAnyOf(spelling.id, spellingIds, "uuid"))
    )
    .onConflictDoNothing();
  await tx
    .update(recipeIngredientFoods)
    .set({ ingredientAliasId: sql`${copySpelling.id}` })
    .from(spelling)
    .innerJoin(copySpelling, foldedIn(copySpelling, householdId, spelling))
    .where(
      and(
        eq(recipeIngredientFoods.ingredientAliasId, spelling.id),
        isAnyOf(spelling.id, spellingIds, "uuid"),
        inArray(recipeIngredientFoods.recipeIngredientId, leaverLines)
      )
    );
  await rekeyNutritionSharesTx(
    tx,
    qb.select({ id: recipes.id }).from(recipes).where(eq(recipes.householdId, householdId)),
    copies
  );
}

/**
 * A copy whose own parent stays behind goes under that parent's nearest seeded ancestor, if any,
 * which nutrition and icons borrow along the tree (ADR-0039).
 */
async function fileUnderSeededAncestorTx(
  tx: DbTransaction,
  foreignFoods: readonly string[],
  copyOf: FoodTargets,
  made: ReadonlySet<string>
): Promise<void> {
  const old = alias(ingredients, "old_food");
  const parent = alias(ingredients, "old_parent");
  const behind = (
    await tx
      .select({ id: old.id, parentId: parent.id })
      .from(old)
      .innerJoin(parent, eq(parent.id, old.parentId))
      .where(and(isAnyOf(old.id, foreignFoods, "uuid"), isNotNull(parent.householdId)))
  ).filter((row) => !copyOf.has(row.parentId) && made.has(copyOf.get(row.id) ?? ""));

  if (behind.length === 0) return;
  const ancestry = await findIngredientAncestors(
    behind.map((row) => row.parentId),
    tx
  );
  const seeded = new Set(
    (
      await tx
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(
          and(
            isAnyOf(ingredients.id, [...new Set([...ancestry.values()].flat())], "uuid"),
            isNull(ingredients.householdId)
          )
        )
    ).map((row) => row.id)
  );
  const nearest = new Map(
    behind.flatMap((row) => {
      const ancestor = ancestry.get(row.parentId)?.find((id) => seeded.has(id));

      return ancestor ? [[copyOf.get(row.id)!, ancestor] as const] : [];
    })
  );

  if (nearest.size === 0) return;
  await tx
    .update(ingredients)
    .set({
      parentId: sql`${pickedByKey(ingredients.id, [...nearest.keys()], "uuid", [...nearest.values()])}::uuid`,
    })
    .where(isAnyOf(ingredients.id, [...nearest.keys()], "uuid"));
}

/**
 * A household of one's catalogue joins `into` (ADR-0042), its recipes moved: each own food has one
 * target, `into`'s food of its name, else the one holding the first spelling they share, and merges
 * into it; a spelling both hold gives its rows to a spelling of that target and goes; a junk mark both
 * hold stays `into`'s; the rest moves as it is. The tree and the foods are locked before anything.
 */
export async function mergeHouseholdCatalogueTx(
  tx: DbTransaction,
  from: string,
  into: string
): Promise<void> {
  await lockTree(tx);
  // A food renamed or deleted while its lock was awaited is read again, and its target with it.
  const pairs = await lockUntilSettled(
    () => joinTargetsOf(tx, from, into),
    (rows) =>
      lockIngredients(
        tx,
        rows.flatMap((row) => [row.source, row.target])
      ),
    (row) => `${row.source} ${row.target}`
  );
  const targets = await oldestFirst(tx, new Map(pairs.map((row) => [row.source, row.target])));
  const joinerSpelling = alias(ingredientAliases, "joiner_spelling");
  const householdSpelling = alias(ingredientAliases, "household_spelling");
  // `into`'s spellings of those folds are held against a delete until the join commits.
  const sharedSpellings = await tx
    .select({ id: joinerSpelling.id })
    .from(joinerSpelling)
    .innerJoin(householdSpelling, foldedIn(householdSpelling, into, joinerSpelling))
    .where(eq(joinerSpelling.householdId, from))
    .orderBy(householdSpelling.id)
    .for("key share", { of: householdSpelling });

  const strandedOn = await followJoinTargetsTx(
    tx,
    from,
    targets,
    new Set([...targets.keys(), ...sharedSpellings.map((row) => row.id)])
  );

  await keepWhatTargetsLackTx(tx, targets);
  await fillCorrectionsTx(tx, from, into, targets);
  for (const [source, target] of targets) {
    await mergeLockedFoods(tx, source, target, { keepFlag: true });
  }
  // AI's doubt a stranded change carried stays only under a change still open.
  await clearAIFlagUnlessOpen(tx, [...new Set(strandedOn)]);
  // Each shared spelling is a target's now: its rows take that food's spelling `into` sees.
  for (const { id } of sharedSpellings) {
    await deleteCatalogueAlias(tx, id, { heirsSeenBy: into });
  }

  const theirJunk = qb
    .select({ fold: ingredientJunkPile.fold })
    .from(ingredientJunkPile)
    .where(eq(ingredientJunkPile.householdId, into));

  await tx
    .delete(ingredientJunkPile)
    .where(
      and(eq(ingredientJunkPile.householdId, from), inArray(ingredientJunkPile.fold, theirJunk))
    );
  for (const table of [ingredients, ingredientAliases, ingredientJunkPile, ingredientAIChanges]) {
    await tx.update(table).set({ householdId: into }).where(eq(table.householdId, from));
  }
}

/** The joiner foods oldest first: where several merge into one target, the order they fill its gaps. */
async function oldestFirst(tx: DbTransaction, targets: FoodTargets): Promise<FoodTargets> {
  if (targets.size === 0) return targets;
  const rows = await tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(isAnyOf(ingredients.id, [...targets.keys()], "uuid"))
    .orderBy(asc(ingredients.createdAt), asc(ingredients.id));

  return new Map(rows.map((row) => [row.id, targets.get(row.id)!]));
}

/** The fields of a correction that stand together: the numbers, the piece weight, the density. */
const CORRECTION_GROUPS = [
  ["numbersFood", "kcal", "fat", "carbs", "protein", "extras"],
  ["pieceWeightFood", "pieceWeight"],
  ["densityFood", "density"],
] as const;

/**
 * Where corrections meet on the food a joiner's lands on, one stays: each group takes the first that
 * has it of the household's row, the joiner's on that food, then its merging foods' (`targets` order).
 */
async function fillCorrectionsTx(
  tx: DbTransaction,
  from: string,
  into: string,
  targets: FoodTargets
): Promise<void> {
  const corrections = ingredientNutritionCorrections;
  const landsOn = (id: string) => targets.get(id) ?? id;
  const rank = new Map([...targets.keys()].map((id, index) => [id, index]));
  const joiners = await tx.select().from(corrections).where(eq(corrections.householdId, from));
  const foods = [...new Set(joiners.map((row) => landsOn(row.ingredientId)))];

  if (foods.length === 0) return;
  const household = await tx
    .select()
    .from(corrections)
    .where(
      and(eq(corrections.householdId, into), isAnyOf(corrections.ingredientId, foods, "uuid"))
    );

  for (const food of foods) {
    const chain = [
      ...household.filter((row) => row.ingredientId === food),
      ...joiners
        .filter((row) => landsOn(row.ingredientId) === food)
        .sort((a, b) => (rank.get(a.ingredientId) ?? -1) - (rank.get(b.ingredientId) ?? -1)),
    ];
    const [kept, ...rest] = chain;

    if (!kept || rest.length === 0) continue;
    const filled = Object.fromEntries(
      CORRECTION_GROUPS.flatMap((group) => {
        const source = chain.find((row) => group.some((field) => row[field] !== null)) ?? kept;

        return group.map((field) => [field, source[field]]);
      })
    );

    await tx.delete(corrections).where(
      isAnyOf(
        corrections.id,
        rest.map((row) => row.id),
        "uuid"
      )
    );
    await tx
      .update(corrections)
      .set({ ...filled, householdId: into, ingredientId: food })
      .where(eq(corrections.id, kept.id));
  }
}

/** Each own food of `from` that `into` has: by name, else by the first spelling they share. */
async function joinTargetsOf(
  tx: DbTransaction,
  from: string,
  into: string
): Promise<Array<{ source: string; target: string }>> {
  const joinerFood = alias(ingredients, "joiner_food");
  const joinerSpelling = alias(ingredientAliases, "joiner_spelling");
  const householdSpelling = alias(ingredientAliases, "household_spelling");
  const byName = await foodsNamedIn(tx, into, (food) => eq(food.householdId, from));
  const bySpelling = await tx
    .select({ source: joinerFood.id, target: householdSpelling.ingredientId })
    .from(joinerSpelling)
    .innerJoin(householdSpelling, foldedIn(householdSpelling, into, joinerSpelling))
    .innerJoin(joinerFood, eq(joinerFood.id, joinerSpelling.ingredientId))
    .where(and(eq(joinerSpelling.householdId, from), eq(joinerFood.householdId, from)))
    .orderBy(joinerSpelling.fold);
  const targets = new Map(byName);

  for (const row of bySpelling) {
    if (!targets.has(row.source)) targets.set(row.source, row.target);
  }

  return [...targets].map(([source, target]) => ({ source, target }));
}

/**
 * What a joiner food knows that its target lacks moves before the merge: the AI estimate and the
 * flag. A seeded target is never written.
 */
async function keepWhatTargetsLackTx(tx: DbTransaction, targets: FoodTargets): Promise<void> {
  if (targets.size === 0) return;
  const sources = [...targets.keys()];
  const own = new Set(
    (
      await tx
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(
          and(
            isAnyOf(ingredients.id, [...targets.values()], "uuid"),
            isNotNull(ingredients.householdId)
          )
        )
    ).map((row) => row.id)
  );
  const estimates = await tx
    .select()
    .from(ingredientNutritionEstimates)
    .where(isAnyOf(ingredientNutritionEstimates.ingredientId, sources, "uuid"));
  // Where several sources share a target, the first in `targets` order gives its estimate and flag.
  const bySource = new Map(estimates.map((row) => [row.ingredientId, row]));
  const firstPerTarget = new Map<string, (typeof estimates)[number]>();

  for (const [source, target] of targets) {
    const estimate = bySource.get(source);

    if (estimate && own.has(target) && !firstPerTarget.has(target)) {
      firstPerTarget.set(target, estimate);
    }
  }
  const moved = [...firstPerTarget].map(
    ([target, { ingredientId: _i, createdAt: _c, version: _v, ...numbers }]) => ({
      ...numbers,
      ingredientId: target,
    })
  );

  if (moved.length > 0) {
    await tx.insert(ingredientNutritionEstimates).values(moved).onConflictDoNothing();
  }
  const flagged = await tx
    .select({ id: ingredients.id, flagReason: ingredients.flagReason })
    .from(ingredients)
    .where(and(isAnyOf(ingredients.id, sources, "uuid"), eq(ingredients.flagged, true)));
  const reasons = new Map(flagged.map((row) => [row.id, row.flagReason]));
  const flags = new Map<string, string | null>();

  for (const [source, target] of targets) {
    if (reasons.has(source) && own.has(target) && !flags.has(target)) {
      flags.set(target, reasons.get(source)!);
    }
  }

  if (flags.size === 0) return;
  await tx
    .update(ingredients)
    .set({
      flagged: true,
      flagReason: sql`${pickedByKey(ingredients.id, [...flags.keys()], "uuid", [...flags.values()])}`,
    })
    .where(and(isAnyOf(ingredients.id, [...flags.keys()], "uuid"), eq(ingredients.flagged, false)));
}
