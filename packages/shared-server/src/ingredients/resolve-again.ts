import type { NamingRow, NamingRows } from "@norish/db/repositories/ingredient-cleanup";
import type { GroceryPart } from "@norish/db/repositories/ingredient-relocation";
import { withTransaction } from "@norish/db/drizzle";
import { findRecipeLineAliases } from "@norish/db/repositories/ingredient-aliases";
import { findIngredientHouseholds } from "@norish/db/repositories/ingredient-catalogue";
import { repointLines } from "@norish/db/repositories/ingredient-cleanup";
import { writeGroceryParts } from "@norish/db/repositories/ingredient-relocation";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { groupBy } from "@norish/shared/lib/group-by";
import { lineMeaning } from "@norish/shared/lib/ingredient-text";

import type { ResolveMode } from "./resolve-mode";
import { mintsIn } from "./resolve-mode";
import { resolveIngredients, resolveLineFoods, typedParts, writeResolved } from "./resolver";

/**
 * Point each row at what its text resolves to in `mode` in its own household, minting there unless
 * repointing;
 * a Grocery naming several foods becomes one per food (`typedParts`). With `refine`, only a line
 * that now reads other foods is written, and one reading none keeps a seeded food (its spelling is
 * AI's spelling check's to judge). Answers how many lines were written.
 */
export async function resolveAgain(
  rows: NamingRows,
  mode: Exclude<ResolveMode, "split">,
  { refine = false }: { refine?: boolean } = {}
): Promise<number> {
  const mint = mintsIn(mode);

  return await writeResolved(
    async () => {
      const units = await getUnits();
      const lines = await resolveByHousehold(rows.lines, async (owned, householdId) => {
        const texts = owned.map(({ name, amount, unit }) =>
          lineMeaning({ text: name ?? "", amount, unit }, units)
        );
        const foods = await resolveLineFoods(texts, { householdId, userId: null }, mode);

        return owned.flatMap((line, index) => {
          const resolved = foods[index];

          // A line naming no food, by its text or (minting) its junk, loses the heir's food.
          if (!texts[index] || (mint && !resolved)) {
            return [{ id: line.id, aliasIds: [], joined: null }];
          }

          return resolved
            ? [
                {
                  id: line.id,
                  aliasIds: resolved.foods.map((food) => food.aliasId),
                  joined: resolved.joined,
                },
              ]
            : [];
        });
      });
      const groceriesOf = (naming: readonly NamingRow[]) =>
        resolveByHousehold(naming, async (owned, householdId) => {
          const split = await typedParts(householdId, owned, { alternatives: "first" });
          const foods = await resolveIngredients(
            split.flat().map((part) => part.name ?? ""),
            { householdId, userId: null },
            mode
          );
          let partIndex = 0;

          return owned.flatMap((row, index) => {
            const parts = split[index]!.flatMap((part): GroceryPart[] => {
              const food = foods[partIndex++];

              return food
                ? [
                    {
                      name: part.name ?? "",
                      aliasId: food.aliasId,
                      ingredientId: food.ingredientId,
                    },
                  ]
                : [];
            });

            // A row naming no food (minting) is kept and points at none, as a line does.
            if (parts.length === 0 && mint && row.name !== null) {
              parts.push({ name: row.name, aliasId: null, ingredientId: null });
            }

            return parts.length > 0 ? [{ id: row.id, name: row.name, parts }] : [];
          });
        });

      const before = refine
        ? await findRecipeLineAliases(
            lines.map((line) => line.id),
            null
          )
        : null;
      const seeded = before
        ? await findSeededAmong(
            [...before.values()].flatMap((line) => line.foods.map((food) => food.ingredientId))
          )
        : new Set<string>();
      const written = (line: (typeof lines)[number]) => {
        const was = before?.get(line.id);

        if (readsAsBefore(line, was)) return false;

        return !(line.aliasIds.length === 0 && was?.foods.some((f) => seeded.has(f.ingredientId)));
      };

      return {
        lines: before ? lines.filter(written) : lines,
        groceries: await groceriesOf(rows.groceries),
        recurring: await groceriesOf(rows.recurring),
      };
    },
    (resolved) =>
      withTransaction(async (tx) => {
        await repointLines(tx, resolved.lines);
        await writeGroceryParts(tx, "groceries", resolved.groceries);
        await writeGroceryParts(tx, "recurring", resolved.recurring);

        return resolved.lines.length;
      })
  );
}

/** Whether a line read again names the foods it named, joined as they were. */
function readsAsBefore(
  line: { aliasIds: readonly string[]; joined: string | null },
  before: { foods: ReadonlyArray<{ aliasId: string }>; joined: string | null } | undefined
): boolean {
  return (
    before !== undefined &&
    before.joined === line.joined &&
    before.foods.length === line.aliasIds.length &&
    before.foods.every((food, index) => food.aliasId === line.aliasIds[index])
  );
}

/** Resolve rows a batch per household, so each reads and mints in its own catalogue (ADR-0042). */
async function resolveByHousehold<R extends NamingRow, T>(
  rows: readonly R[],
  resolve: (held: R[], householdId: string) => Promise<T[]>
): Promise<T[]> {
  const resolved: T[] = [];

  for (const [householdId, held] of groupBy(rows, (row) => row.householdId)) {
    resolved.push(...(await resolve(held, householdId)));
  }

  return resolved;
}

/** Which of these foods are seeded. */
async function findSeededAmong(ids: readonly string[]): Promise<Set<string>> {
  const households = await findIngredientHouseholds(ids);

  return new Set(ids.filter((id) => households.get(id) === null));
}
