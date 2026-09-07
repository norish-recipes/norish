import type { AisleFilingInput, StoreDto } from "@norish/shared/contracts";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

import type { AisleResolver, ContainerId, ItemsState, ReorderUpdate } from "./types";
import { placeOfContainer, storeContainers } from "./utils";

export interface DropPlan {
  /** Every row whose place changed: a per-Store sort order, and the Store on the one that moved Store. */
  updates: ReorderUpdate[];
  /** What the drop teaches the target Store — a name filed under an aisle, or under none — written after the reorder. */
  filings: AisleFilingInput[];
}

interface DropInput {
  /** The containers as the drag left them: the visual order to commit. */
  items: ItemsState;
  /** The container the dragged thing sat in when the drag began. */
  originContainer: ContainerId;
  /** The container it was dropped into. */
  targetContainer: ContainerId;
  stores: StoreDto[];
  aisleFor: AisleResolver;
  /** The grocery ids the dragged key stands for: one row, or a group's sources. */
  movedIds: readonly string[];
  /** The distinct names the dragged key carries; a group files every one of them. */
  movedNames: readonly string[];
  /**
   * The grocery ids behind each key in `items`, in order: a row is its own
   * id, a group is its sources' ids, which all take the group's position.
   */
  idsOf: (key: string) => readonly string[];
}

/**
 * What a drop means, in two mutations that stay separate and each idempotent.
 *
 * Sort order is one number per Store, so every row of the target Store — and
 * of the Store the drag left, when that is another — is re-numbered in the
 * order its block shows them: the unfiled area first, then each aisle in the
 * Store's order, rows within an aisle following it. The row that changed
 * Store carries its new Store on the same update.
 *
 * Then the filing. A drop into an aisle of the row's own Store files the name
 * there; a drop into the Store's unfiled area forgets it; a drop into another
 * Store's aisle files it there, after the reorder, so the grocery sits under
 * the Store before its name is taught to it; a drop into another Store's
 * unfiled area, or into `unsorted`, teaches nothing. Only a filing that
 * differs from what the Store remembers is written (ADR-0031).
 */
export function planDrop(input: DropInput): DropPlan {
  const { items, originContainer, targetContainer, stores, aisleFor, movedNames, idsOf } = input;
  const moved = new Set(input.movedIds);
  const origin = placeOfContainer(originContainer, stores);
  const target = placeOfContainer(targetContainer, stores);
  const changedStore = origin.storeId !== target.storeId;

  const updates = new Map<string, ReorderUpdate>();
  const renumber = (storeId: string | null) => {
    let position = 0;

    for (const containerId of storeContainers(storeId, stores)) {
      for (const key of items[containerId] ?? []) {
        for (const id of idsOf(key)) {
          const update: ReorderUpdate = { id, sortOrder: position };

          if (changedStore && moved.has(id)) update.storeId = target.storeId;
          updates.set(id, update);
        }
        position += 1;
      }
    }
  };

  renumber(target.storeId);
  if (changedStore) renumber(origin.storeId);

  const filings: AisleFilingInput[] = [];

  if (target.storeId !== null && (!changedStore || target.aisleId !== null)) {
    const seen = new Set<string>();

    for (const name of movedNames) {
      const normalized = normalizeGroceryName(name);

      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      if (aisleFor(target.storeId, name) === target.aisleId) continue;
      filings.push({ storeId: target.storeId, name, aisleId: target.aisleId });
    }
  }

  return { updates: [...updates.values()], filings };
}
