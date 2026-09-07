import type { AisleDto } from "@norish/shared/contracts";
import { sortAisles } from "@norish/shared/lib/aisles";

export interface AisleBlock<T> {
  aisle: AisleDto;
  rows: T[];
}

export interface AislePartition<T> {
  /** Rows the Store has never been told about: first, under no heading, so they are noticed and filed. */
  unfiled: T[];
  /** Every aisle of the Store in the Store's order, each with what is filed under it, empty or not. */
  blocks: AisleBlock<T>[];
}

/**
 * The shape of a Store's block: unfiled rows first, then every aisle in the
 * Store's order, whether or not anything is filed there (ADR-0031). A row
 * filed under an aisle the Store no longer has is unfiled, not lost. The
 * rows' own order is kept within each part.
 */
export function partitionByAisle<T>(
  rows: readonly T[],
  aisles: readonly AisleDto[],
  aisleOf: (row: T) => string | null
): AislePartition<T> {
  const ordered = sortAisles(aisles);
  const byAisle = new Map<string, T[]>(ordered.map((aisle) => [aisle.id, []]));
  const unfiled: T[] = [];

  for (const row of rows) {
    const aisleId = aisleOf(row);
    const block = aisleId === null ? undefined : byAisle.get(aisleId);

    if (block) block.push(row);
    else unfiled.push(row);
  }

  return {
    unfiled,
    blocks: ordered.map((aisle) => ({ aisle, rows: byAisle.get(aisle.id) ?? [] })),
  };
}
