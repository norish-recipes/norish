import type { StoreDto } from "@norish/shared/contracts";
import { foodKey } from "@norish/shared/lib/spelling-keys";

import type {
  AisleResolver,
  ContainerId,
  FileGroceryName,
  ItemsState,
  ReorderUpdate,
} from "./drop-containers";
import { placeOfContainer, storeContainers } from "./drop-containers";

/** A grocery as a drop files it: its name, and the Ingredient that is filed. */
interface FiledGrocery {
  name: string | null;
  ingredientId?: string | null;
}

/** What a drop teaches a Store about one grocery. */
interface DropFiling {
  storeId: string;
  grocery: FiledGrocery;
  aisleId: string | null;
}

interface DropPlan {
  /** Every row whose place changed: a per-Store sort order, and the Store on the one that moved Store. */
  updates: ReorderUpdate[];
  /** What the drop teaches the target Store — a grocery filed under an aisle, or under none — written after the reorder. */
  filings: DropFiling[];
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
  /** The groceries the dragged key carries; a group files every one of them. */
  movedGroceries: readonly FiledGrocery[];
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
  const { items, originContainer, targetContainer, stores, aisleFor, movedGroceries, idsOf } =
    input;
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

  const filings: DropFiling[] = [];

  if (target.storeId !== null && (!changedStore || target.aisleId !== null)) {
    const seen = new Set<string>();

    for (const grocery of movedGroceries) {
      // One filing per food: a group's sources are mostly one Ingredient. A
      // grocery added offline has none yet, and is told apart by the key its
      // name will resolve by ("onions, diced" is "onions").
      const key = grocery.ingredientId ?? `name:${foodKey(grocery.name)}`;

      if (!grocery.name?.trim() || seen.has(key)) continue;
      seen.add(key);
      if (grocery.ingredientId && aisleFor(target.storeId, grocery.ingredientId) === target.aisleId)
        continue;
      filings.push({ storeId: target.storeId, grocery, aisleId: target.aisleId });
    }
  }

  return { updates: [...updates.values()], filings };
}

/** `items` with `key` taken out of `from` and put into `to` at `index`, counted without it. */
export function moveKey(
  items: ItemsState,
  key: string,
  from: ContainerId,
  to: ContainerId,
  index: number
): ItemsState {
  const left = (items[from] ?? []).filter((other) => other !== key);
  const into = from === to ? left : (items[to] ?? []);

  return { ...items, [from]: left, [to]: [...into.slice(0, index), key, ...into.slice(index)] };
}

interface ListDropInput {
  /** The containers as the drop left them. */
  items: ItemsState;
  /** The dragged key: a row's id, or a group's key. */
  key: string;
  origin: ContainerId;
  target: ContainerId;
  stores: StoreDto[];
  aisleFor: AisleResolver;
  /** The groceries a key stands for: one row, or a group's lines. */
  linesOf: (key: string) => readonly (FiledGrocery & { id: string })[];
}

/** `planDrop` for a list keyed by row or group: a key that stands for no grocery plans nothing. */
export function planListDrop({ key, linesOf, origin, target, ...list }: ListDropInput): DropPlan {
  const lines = linesOf(key);

  if (lines.length === 0) return { updates: [], filings: [] };

  return planDrop({
    ...list,
    originContainer: origin,
    targetContainer: target,
    movedIds: lines.map((grocery) => grocery.id),
    movedGroceries: lines,
    idsOf: (other) => linesOf(other).map((grocery) => grocery.id),
  });
}

/** Sends a plan: the reorder first, then each filing. False when it holds nothing to write. */
export function writeDrop(
  { updates, filings }: DropPlan,
  onReorder: (updates: ReorderUpdate[]) => void,
  onFileGroceryName: FileGroceryName
): boolean {
  if (updates.length > 0) onReorder(updates);
  for (const filing of filings) onFileGroceryName(filing.storeId, filing.grocery, filing.aisleId);

  return updates.length > 0 || filings.length > 0;
}
