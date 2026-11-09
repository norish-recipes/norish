"use client";

import type { ComponentProps } from "react";
import { useState } from "react";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import {
  useGroceriesMutations,
  useGroceriesQuery,
  useGroceriesUiStore,
  useGroceryFor,
  useRecurringGroceryFor,
  useStoresQuery,
} from "@norish/shared-react/groceries";
import { useDevicePreference } from "@norish/shared-react/reader";
import { cssFloatingDockContentClearance } from "@norish/web/config/css-tokens";

import {
  ClearGroceriesModal,
  GroceryList,
  GroceryListByRecipe,
  GrocerySkeleton,
} from "./components/list";
import { AddGroceryPanel, EditGroceryPanel } from "./components/panels";
import { StoreManagerPanel } from "./components/stores";

const NO_IDS: string[] = [];

/** The grocery list's page: the list in the reader's view, and the panels it opens. */
export function GroceriesListScreen() {
  const { groceries, recurringGroceries, recipeMap, isLoading, getRecipeNameForGrocery } =
    useGroceriesQuery();
  const {
    toggleGroceries,
    deleteGroceries,
    createGrocery,
    createRecurringGrocery,
    reorderGroceriesInStore,
    markAllDoneInStore,
    deleteDoneInStore,
  } = useGroceriesMutations();
  const { stores } = useStoresQuery();
  // Device Preferences: the server renders the page the way the reader left it.
  const [viewMode] = useDevicePreference("groceryViewMode");
  const [groupSimilarIngredients] = useDevicePreference("groceryGroupSimilar");
  const setEditingGroceryId = useGroceriesUiStore((state) => state.setEditingGroceryId);

  type ClearScope =
    | { kind: "store"; storeId: string | null; name: string }
    | { kind: "recipe"; ids: string[]; name: string };
  const [clearScope, setClearScope] = useState<ClearScope | null>(null);
  // The same empty list while the modal is closed, so a list change doesn't re-render it.
  const clearIds =
    clearScope === null
      ? NO_IDS
      : clearScope.kind === "store"
        ? groceries.filter((g) => g.storeId === clearScope.storeId).map((g) => g.id)
        : clearScope.ids;
  const handleClearConfirm = () => {
    if (clearIds.length > 0) deleteGroceries(clearIds);
  };
  const handleToggle = (id: string, isDone: boolean) => {
    toggleGroceries([id], isDone);
  };
  const handleToggleGroup = (ids: string[], isDone: boolean) => {
    toggleGroceries(ids, isDone);
  };
  const handleEdit = (grocery: GroceryDto) => {
    setEditingGroceryId(grocery.id);
  };
  const handleDelete = (id: string) => {
    deleteGroceries([id]);
  };
  const handleClearAllInStore = (storeId: string | null, name: string) => {
    setClearScope({ kind: "store", storeId, name });
  };
  const groceryGrouping = groupSimilarIngredients ? "grouped" : "flat";

  if (isLoading) {
    // The markers ride the skeleton too: the server response carries the
    // stored view and grouping even while the list itself is still on its
    // way.
    return (
      <div
        className="contents"
        data-grocery-grouping={groceryGrouping}
        data-grocery-view={viewMode}
      >
        <GrocerySkeleton />
      </div>
    );
  }

  return (
    <>
      <div
        className="flex min-h-0 w-full flex-1 flex-col"
        data-grocery-grouping={groceryGrouping}
        data-grocery-view={viewMode}
      >
        {/* Grocery list */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "store" ? (
            <GroceryList
              getRecipeNameForGrocery={getRecipeNameForGrocery}
              groceries={groceries}
              groupSimilarIngredients={groupSimilarIngredients}
              recurringGroceries={recurringGroceries}
              stores={stores}
              onClearAllInStore={handleClearAllInStore}
              onDelete={handleDelete}
              onDeleteDoneInStore={deleteDoneInStore}
              onEdit={handleEdit}
              onMarkAllDoneInStore={markAllDoneInStore}
              onReorderInStore={reorderGroceriesInStore}
              onToggle={handleToggle}
              onToggleGroup={handleToggleGroup}
            />
          ) : (
            <GroceryListByRecipe
              groceries={groceries}
              recipeMap={recipeMap}
              recurringGroceries={recurringGroceries}
              stores={stores}
              onClearRecipe={(ids, name) => setClearScope({ kind: "recipe", ids, name })}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onReorder={reorderGroceriesInStore}
              onToggle={handleToggle}
            />
          )}
        </div>

        {/* The add pill is fixed, so the list has to stop above it rather than
            run on underneath: the shell's own padding clears the nav pill and
            this clears the row the add pill stands in. Phone only — the
            desktop add button lives in the header. */}
        <div
          aria-hidden
          className="shrink-0 md:hidden"
          style={{ height: cssFloatingDockContentClearance }}
        />
      </div>

      {/* Panels, each reading whether it is open, so opening one renders only that panel */}
      <AddGrocery
        stores={stores}
        onCreate={createGrocery}
        onCreateRecurring={createRecurringGrocery}
      />
      <StoreManager stores={stores} />
      <EditGrocery stores={stores} />

      <ClearGroceriesModal
        isOpen={clearScope !== null}
        itemCount={clearIds.length}
        scopeName={clearScope?.name ?? null}
        onClose={() => setClearScope(null)}
        onConfirm={handleClearConfirm}
      />
    </>
  );
}

function AddGrocery(props: Omit<ComponentProps<typeof AddGroceryPanel>, "open" | "onOpenChange">) {
  const open = useGroceriesUiStore((state) => state.addGroceryPanelOpen);
  const setOpen = useGroceriesUiStore((state) => state.setAddGroceryPanelOpen);

  return <AddGroceryPanel {...props} open={open} onOpenChange={setOpen} />;
}

function StoreManager({ stores }: { stores: StoreDto[] }) {
  const open = useGroceriesUiStore((state) => state.storeManagerOpen);
  const setOpen = useGroceriesUiStore((state) => state.setStoreManagerOpen);

  return <StoreManagerPanel open={open} stores={stores} onOpenChange={setOpen} />;
}

/** The edit panel over the grocery as the list holds it now, closed once it is gone. */
export function EditGrocery({ stores }: { stores: StoreDto[] }) {
  const groceryId = useGroceriesUiStore((state) => state.editingGroceryId);
  const setEditingGroceryId = useGroceriesUiStore((state) => state.setEditingGroceryId);
  const grocery = useGroceryFor(groceryId);
  const recurringGrocery = useRecurringGroceryFor(groceryId);
  const {
    deleteGroceries,
    createRecurringGrocery,
    updateGrocery,
    updateRecurringGrocery,
    deleteRecurringGrocery,
  } = useGroceriesMutations();

  if (!grocery) return null;

  const handleSave = (
    itemName: string,
    pattern: RecurrencePattern | null,
    storeId?: string | null,
    purchaseAmount?: number | null
  ) => {
    if (recurringGrocery) {
      // Already recurring - update the recurring grocery (store change included)
      updateRecurringGrocery(
        recurringGrocery.id,
        grocery.id,
        itemName,
        pattern,
        storeId,
        purchaseAmount
      );
    } else if (pattern) {
      // Convert regular grocery to recurring without racing an update against the delete.
      createRecurringGrocery(
        itemName,
        pattern,
        storeId !== undefined ? storeId : grocery.storeId,
        purchaseAmount
      );
      deleteGroceries([grocery.id]);
    } else {
      // Simple update
      updateGrocery(grocery.id, itemName, storeId, purchaseAmount);
    }
  };
  const handleDelete = () => {
    if (recurringGrocery) {
      deleteRecurringGrocery(recurringGrocery.id);
    } else {
      deleteGroceries([grocery.id]);
    }
    setEditingGroceryId(null);
  };

  return (
    <EditGroceryPanel
      open
      grocery={grocery}
      recurringGrocery={recurringGrocery}
      stores={stores}
      onDelete={handleDelete}
      onOpenChange={(open) => !open && setEditingGroceryId(null)}
      onSave={handleSave}
    />
  );
}
