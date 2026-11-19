import { useState } from "react";

import { useIngredientsSubscription } from "@norish/shared-react/config";
import {
  useGroceriesSubscription,
  useStoreAislesSubscription,
  useStorePricesSubscription,
  useStoresSubscription,
} from "@norish/shared-react/groceries";

/** What the Groceries page keeps for its list while the Pantry shows: the folds and the realtime. */
export function useGroceryListState() {
  const [doneOpen, setDoneOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());

  // The list's realtime; the Warm Set keeps its reads for the first frame.
  useGroceriesSubscription();
  useStoresSubscription();
  useStorePricesSubscription();
  useStoreAislesSubscription();
  useIngredientsSubscription();

  return { doneOpen, setDoneOpen, collapsed, setCollapsed, openGroups, setOpenGroups };
}

export type GroceryListState = ReturnType<typeof useGroceryListState>;
