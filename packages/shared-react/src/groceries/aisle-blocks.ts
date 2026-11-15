import type { AisleDto, StoreDto } from "@norish/shared/contracts";
import { sortAisles } from "@norish/shared/lib/aisles";

export interface AisleBlock<T> {
  aisle: AisleDto;
  rows: T[];
}

export interface AisleBlocks<T> {
  /** Rows the Store has never been told about, or whose aisle it no longer has: shown first, under no heading. */
  unfiled: T[];
  /** Every aisle of the Store in the Store's order, each with what is filed under it, empty or not. */
  blocks: AisleBlock<T>[];
}

/**
 * A Store's rows placed in its aisles (ADR-0031), in the order given. No Store, such as Unsorted,
 * has no aisles, so every row is unfiled.
 */
export function placeInAisles<T>(
  store: Pick<StoreDto, "aisles"> | null | undefined,
  rows: readonly T[],
  aisleIdOf: (row: T) => string | null
): AisleBlocks<T> {
  const blocks = sortAisles(store?.aisles ?? []).map((aisle) => ({ aisle, rows: [] as T[] }));
  const byAisle = new Map(blocks.map((block) => [block.aisle.id, block.rows]));
  const unfiled: T[] = [];

  for (const row of rows) {
    const aisleId = aisleIdOf(row);

    (aisleId === null ? unfiled : (byAisle.get(aisleId) ?? unfiled)).push(row);
  }

  return { unfiled, blocks };
}
