import type { NamingRow, NamingRows } from "@norish/db/repositories/ingredient-cleanup";
import type { GroceryPart } from "@norish/db/repositories/ingredient-relocation";
import { withTransaction } from "@norish/db/drizzle";
import { findRecipeLineAliases } from "@norish/db/repositories/ingredient-aliases";
import { findIngredientIdsAmong } from "@norish/db/repositories/ingredient-catalogue";
import { repointLines } from "@norish/db/repositories/ingredient-cleanup";
import { writeGroceryParts } from "@norish/db/repositories/ingredient-relocation";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { lineFoodText, lineNamesNoFood } from "@norish/shared/lib/ingredient-text";

import type { ResolveMode } from "./resolver";
import { resolveIngredients, resolveLineFoods, typedParts, writeResolved } from "./resolver";

/**
 * Point each row at what its text resolves to in `mode`, minting for its owner unless repointing;
 * a Grocery naming several foods becomes one per food (`typedParts`). With `refine`, only a line
 * that now reads other foods is written, and one reading none keeps a seeded food (its spelling is
 * AI's spelling check's to judge). Answers how many lines were written.
 */
export async function resolveAgain(
  rows: NamingRows,
  mode: Exclude<ResolveMode, "split">,
  { refine = false }: { refine?: boolean } = {}
): Promise<number> {
  const mint = mode !== "repoint";

  return await writeResolved(
    async () => {
      const units = await getUnits();
      const lines = await resolveByOwner(rows.lines, async (owned, userId) => {
        const texts = owned.map(({ name, amount, unit }) =>
          lineNamesNoFood({ text: name ?? "", amount })
            ? ""
            : lineFoodText({ text: name ?? "", amount, unit }, units)
        );
        const foods = await resolveLineFoods(texts, { userId }, mode);

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
        resolveByOwner(naming, async (owned, userId) => {
          const split = await typedParts(owned, { alternatives: "first" });
          const foods = await resolveIngredients(
            split.flat().map((part) => part.name ?? ""),
            { userId },
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

      const before = refine ? await findRecipeLineAliases(lines.map((line) => line.id)) : null;
      const seeded = before
        ? await findIngredientIdsAmong(
            [...before.values()].flatMap((line) => line.foods.map((food) => food.ingredientId)),
            "seeded"
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

/** Resolve rows a batch per owner, so what a text mints is its row's owner's. */
async function resolveByOwner<R extends NamingRow, T>(
  rows: readonly R[],
  resolve: (owned: R[], userId: string | null) => Promise<T[]>
): Promise<T[]> {
  const byOwner = new Map<string | null, R[]>();
  const resolved: T[] = [];

  for (const row of rows) byOwner.set(row.ownerId, [...(byOwner.get(row.ownerId) ?? []), row]);

  for (const [userId, owned] of byOwner) resolved.push(...(await resolve(owned, userId)));

  return resolved;
}
