"use client";

import type { GroceryDto } from "@/types";
import type { RecurrencePattern } from "@/types/recurrence";

import { Button } from "@heroui/react";
import { PlusIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { useGroceriesContext, useGroceriesUIContext } from "../context";
import { useStoresContext } from "../stores-context";
import { GroceryList, StoreManagerPanel } from "@/components/groceries";
import AddGroceryPanel from "@/components/Panel/consumers/add-grocery-panel";
import EditGroceryPanel from "@/components/Panel/consumers/edit-grocery-panel";
import GrocerySkeleton from "@/components/skeleton/grocery-skeleton";

export function GroceriesPageDesktop() {
  const {
    groceries,
    recurringGroceries,
    isLoading,
    toggleGroceries,
    deleteGroceries,
    createGrocery,
    createRecurringGrocery,
    updateGrocery,
    updateRecurringGrocery,
    deleteRecurringGrocery,
    assignGroceryToStore,
    reorderGroceriesInStore,
    getRecurringGroceryForGrocery,
    markAllDoneInStore,
    deleteDoneInStore,
  } = useGroceriesContext();

  const { stores, storeManagerOpen, setStoreManagerOpen } = useStoresContext();

  const {
    addGroceryPanelOpen,
    setAddGroceryPanelOpen,
    editingGrocery,
    setEditingGrocery,
  } = useGroceriesUIContext();

  const [searchQuery, setSearchQuery] = useState("");

  const handleToggle = (id: string, isDone: boolean) => {
    toggleGroceries([id], isDone);
  };

  const handleEdit = (grocery: GroceryDto) => {
    setEditingGrocery(grocery);
  };

  const handleDelete = (id: string) => {
    deleteGroceries([id]);
  };

  const handleAssignToStore = (groceryId: string, storeId: string | null) => {
    assignGroceryToStore(groceryId, storeId);
  };

  // Edit panel handlers
  const editingRecurringGrocery = editingGrocery
    ? getRecurringGroceryForGrocery(editingGrocery.id)
    : null;

  const handleEditSave = (itemName: string, pattern: RecurrencePattern | null) => {
    if (!editingGrocery) return;

    if (editingRecurringGrocery) {
      // Already recurring - update the recurring grocery
      updateRecurringGrocery(
        editingRecurringGrocery.id,
        editingGrocery.id,
        itemName,
        pattern
      );
    } else if (pattern) {
      updateGrocery(editingGrocery.id, itemName);
      createRecurringGrocery(itemName, pattern, editingGrocery.storeId);
      deleteGroceries([editingGrocery.id]);
    } else {
      updateGrocery(editingGrocery.id, itemName);
    }
  };

  const handleEditAssignToStore = (storeId: string | null, savePreference?: boolean) => {
    if (!editingGrocery) return;
    assignGroceryToStore(editingGrocery.id, storeId, savePreference);
  };

  const handleEditDelete = () => {
    if (!editingGrocery) return;

    if (editingRecurringGrocery) {
      deleteRecurringGrocery(editingRecurringGrocery.id);
    } else {
      deleteGroceries([editingGrocery.id]);
    }
    setEditingGrocery(null);
  };

  // Filter groceries by search query
  const filteredGroceries = searchQuery.trim()
    ? groceries.filter((g) =>
        g.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : groceries;

  if (isLoading) {
    return <GrocerySkeleton />;
  }

  return (
    <>
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Groceries</h1>
          <div className="flex items-center gap-2">
            <Button
              color="primary"
              startContent={<PlusIcon className="h-5 w-5" />}
              onPress={() => setAddGroceryPanelOpen(true)}
            >
              Add Item
            </Button>
            <Button
              isIconOnly
              variant="flat"
              onPress={() => setStoreManagerOpen(true)}
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Grocery list */}
        <div className="flex-1 overflow-y-auto">
          <GroceryList
            groceries={filteredGroceries}
            recurringGroceries={recurringGroceries}
            stores={stores}
            onAssignToStore={handleAssignToStore}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onReorderInStore={reorderGroceriesInStore}
            onToggle={handleToggle}
            onMarkAllDoneInStore={markAllDoneInStore}
            onDeleteDoneInStore={deleteDoneInStore}
          />
        </div>
      </div>

      {/* Panels */}
      <AddGroceryPanel
        open={addGroceryPanelOpen}
        stores={stores}
        onCreate={createGrocery}
        onCreateRecurring={createRecurringGrocery}
        onOpenChange={setAddGroceryPanelOpen}
      />

      <StoreManagerPanel
        open={storeManagerOpen}
        stores={stores}
        onOpenChange={setStoreManagerOpen}
      />

      {editingGrocery && (
        <EditGroceryPanel
          grocery={editingGrocery}
          open={!!editingGrocery}
          recurringGrocery={editingRecurringGrocery}
          stores={stores}
          onAssignToStore={handleEditAssignToStore}
          onDelete={handleEditDelete}
          onOpenChange={(open) => !open && setEditingGrocery(null)}
          onSave={handleEditSave}
        />
      )}
    </>
  );
}
