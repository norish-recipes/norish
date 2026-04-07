"use client";

import { useMemo } from "react";
import { useUnitsQuery } from "@/hooks/config/use-units-query";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import { groupGroceriesByIngredient } from "@norish/shared/lib/grocery-grouping";

import { DndGroceryProvider, DndGroupedGroceryProvider } from "./dnd";
import { GroupedStoreSection } from "./grouped-store-section";
import { StoreSection } from "./store-section";

interface GroceryListProps {
  groceries: GroceryDto[];
  stores: StoreDto[];
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  /** Toggle multiple groceries at once (for grouped mode) */
  onToggleGroup?: (ids: string[], isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  /** Called on drop - commits reorder (and optional store change) to backend */
  onReorderInStore?: (
    updates: { id: string; sortOrder: number; storeId?: string | null }[]
  ) => void;
  onMarkAllDoneInStore?: (storeId: string | null) => void;
  onDeleteDoneInStore?: (storeId: string | null) => void;
  getRecipeNameForGrocery?: (grocery: GroceryDto) => string | null;
  /** Whether to group similar ingredients together */
  groupSimilarIngredients?: boolean;
}

export function GroceryList({
  groceries,
  stores,
  recurringGroceries,
  onToggle,
  onToggleGroup,
  onEdit,
  onDelete,
  onReorderInStore,
  onMarkAllDoneInStore,
  onDeleteDoneInStore,
  getRecipeNameForGrocery,
  groupSimilarIngredients = false,
}: GroceryListProps) {
  const t = useTranslations("groceries.empty");
  const { units: customUnits } = useUnitsQuery();

  // Group groceries by storeId
  const groupedGroceries = useMemo(() => {
    const groups: Map<string | null, GroceryDto[]> = new Map();

    // Initialize with null for unsorted
    groups.set(null, []);

    // Initialize groups for each store
    stores.forEach((store) => {
      groups.set(store.id, []);
    });

    // Group groceries
    groceries.forEach((grocery) => {
      const storeId = grocery.storeId;

      // If the storeId doesn't exist in our map (orphaned), put in unsorted
      if (!groups.has(storeId)) {
        groups.get(null)!.push(grocery);
      } else {
        groups.get(storeId)!.push(grocery);
      }
    });

    return groups;
  }, [groceries, stores]);

  // Get unsorted groceries
  const unsortedGroceries = groupedGroceries.get(null) ?? [];

  // Get stores in order with their groceries
  const storeWithGroceries = useMemo(() => {
    return stores
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((store) => ({
        store,
        groceries: groupedGroceries.get(store.id) ?? [],
      }));
  }, [stores, groupedGroceries]);

  // Compute grouped groceries by ingredient (for grouped mode)
  const ingredientGroups = useMemo(() => {
    if (!groupSimilarIngredients) return null;

    return groupGroceriesByIngredient(
      groceries,
      getRecipeNameForGrocery ?? (() => null),
      customUnits
    );
  }, [groupSimilarIngredients, groceries, getRecipeNameForGrocery, customUnits]);

  // Check if there are any groceries at all
  const hasGroceries = groceries.length > 0;
  const hasStores = stores.length > 0;

  if (!hasGroceries && !hasStores) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <div className="bg-content1/90 shadow-large relative w-full max-w-xl rounded-xl backdrop-blur-xl">
          <div className="flex flex-col items-center gap-6 p-10 text-center">
            <div className="relative">
              <div className="bg-primary-500/20 dark:bg-primary-400/15 absolute inset-0 scale-125 rounded-full blur-3xl" />
              <div className="bg-primary-500/15 text-primary-500 relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
                <ShoppingCartIcon className="h-7 w-7" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{t("title")}</h2>
              <p className="text-default-500 text-base">{t("description")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grouped mode - with group-aware DnD
  if (groupSimilarIngredients && ingredientGroups && onToggleGroup) {
    // Sort stores by sortOrder for grouped view
    const sortedStores = stores.slice().sort((a, b) => a.sortOrder - b.sortOrder);

    return (
      <DndGroupedGroceryProvider
        groupedGroceries={ingredientGroups}
        stores={stores}
        onReorderGroups={onReorderInStore ?? (() => {})}
      >
        <div className="flex flex-col gap-3 p-1">
          {/* Unsorted section */}
          <motion.div
            key="unsorted"
            layout
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          >
            <GroupedStoreSection
              allGroups={ingredientGroups}
              groceries={unsortedGroceries}
              groups={ingredientGroups.get(null) ?? []}
              recurringGroceries={recurringGroceries}
              store={null}
              onDelete={onDelete}
              onDeleteDone={() => onDeleteDoneInStore?.(null)}
              onEdit={onEdit}
              onMarkAllDone={() => onMarkAllDoneInStore?.(null)}
              onToggle={onToggle}
              onToggleGroup={onToggleGroup}
            />
          </motion.div>

          {/* Store sections */}
          {sortedStores.map((store) => {
            const storeGroceries = groupedGroceries.get(store.id) ?? [];
            const storeGroups = ingredientGroups.get(store.id) ?? [];

            return (
              <motion.div
                key={store.id}
                layout
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                initial={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              >
                <GroupedStoreSection
                  allGroups={ingredientGroups}
                  groceries={storeGroceries}
                  groups={storeGroups}
                  recurringGroceries={recurringGroceries}
                  store={store}
                  onDelete={onDelete}
                  onDeleteDone={() => onDeleteDoneInStore?.(store.id)}
                  onEdit={onEdit}
                  onMarkAllDone={() => onMarkAllDoneInStore?.(store.id)}
                  onToggle={onToggle}
                  onToggleGroup={onToggleGroup}
                />
              </motion.div>
            );
          })}
        </div>
      </DndGroupedGroceryProvider>
    );
  }

  // Normal mode - with DnD
  return (
    <DndGroceryProvider
      getRecipeNameForGrocery={getRecipeNameForGrocery}
      groceries={groceries}
      recurringGroceries={recurringGroceries}
      stores={stores}
      onReorderInStore={onReorderInStore ?? (() => {})}
    >
      <div className="flex flex-col gap-3 p-1">
        {/* Unsorted section - always rendered when dragging or has items, so it's a valid drop target */}
        <motion.div
          key="unsorted"
          layout
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        >
          <StoreSection
            allGroceries={groceries}
            getRecipeNameForGrocery={getRecipeNameForGrocery}
            groceries={unsortedGroceries}
            recurringGroceries={recurringGroceries}
            store={null}
            onDelete={onDelete}
            onDeleteDone={() => onDeleteDoneInStore?.(null)}
            onEdit={onEdit}
            onMarkAllDone={() => onMarkAllDoneInStore?.(null)}
            onToggle={onToggle}
          />
        </motion.div>

        {/* Store sections */}
        {storeWithGroceries.map(({ store, groceries: storeGroceries }) => (
          <motion.div
            key={store.id}
            layout
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          >
            <StoreSection
              allGroceries={groceries}
              getRecipeNameForGrocery={getRecipeNameForGrocery}
              groceries={storeGroceries}
              recurringGroceries={recurringGroceries}
              store={store}
              onDelete={onDelete}
              onDeleteDone={() => onDeleteDoneInStore?.(store.id)}
              onEdit={onEdit}
              onMarkAllDone={() => onMarkAllDoneInStore?.(store.id)}
              onToggle={onToggle}
            />
          </motion.div>
        ))}
      </div>
    </DndGroceryProvider>
  );
}
