import { useMemo } from "react";

import type { AisleDto } from "@norish/shared/contracts";

import { aisleContainerId } from "./dnd";

export interface AisleBlock<T> {
  aisle: AisleDto;
  rows: T[];
}

export interface AisleBlocks<T> {
  /** Rows the Store has never been told about: first, under no heading, so they are noticed and filed. */
  unfiled: T[];
  /** Every aisle of the Store in the Store's order, each with what is filed under it, empty or not. */
  blocks: AisleBlock<T>[];
  /** Everything active in the block, in the order it is shown: the unfiled rows, then aisle by aisle. */
  active: T[];
}

/**
 * The shape of a Store's block, read off the drag state: unfiled rows first,
 * under no heading, then every aisle of the Store in its order, whether or not
 * anything is filed there (ADR-0031). Both the flat and the grouped block are
 * this shape; `activeIn` says what is in one container now, in drag order.
 */
export function useAisleBlocks<T>(
  containerId: string,
  aisles: readonly AisleDto[] | undefined,
  activeIn: (containerId: string) => T[]
): AisleBlocks<T> {
  return useMemo(() => {
    const unfiled = activeIn(containerId);
    const blocks = (aisles ?? []).map((aisle) => ({
      aisle,
      rows: activeIn(aisleContainerId(aisle.id)),
    }));

    return { unfiled, blocks, active: [...unfiled, ...blocks.flatMap((block) => block.rows)] };
  }, [activeIn, containerId, aisles]);
}
