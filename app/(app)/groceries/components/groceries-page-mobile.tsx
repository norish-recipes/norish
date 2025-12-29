"use client";

import type { GroceryDto } from "@/types";

import { Button } from "@heroui/react";
import { PlusIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";

import { useGroceriesContext, useGroceriesUIContext } from "../context";
import { useStoresContext } from "../stores-context";
import { GroceryList, StoreManagerPanel } from "@/components/groceries";
import AddGroceryPanel from "@/components/Panel/consumers/add-grocery-panel";
import EditGroceryPanel from "@/components/Panel/consumers/edit-grocery-panel";

export function GroceriesPageMobile() {
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
    getRecurringGroceryForGrocery,
  } = useGroceriesContext();

  const { stores, storeManagerOpen, setStoreManagerOpen } = useStoresContext();

  const {
    addGroceryPanelOpen,
    setAddGroceryPanelOpen,
    editingGrocery,
    setEditingGrocery,
  } = useGroceriesUIContext();

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

  const handleEditSave = (itemName: string, pattern: import("@/types/recurrence").RecurrencePattern | null) => {
    if (!editingGrocery) return;

    if (editingRecurringGrocery) {
      updateRecurringGrocery(
        editingRecurringGrocery.id,
        editingGrocery.id,
        itemName,
        pattern
      );
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

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-default-400">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {/* Full screen mobile layout */}
      <div className="-mx-6 -mt-10 flex min-h-0 w-screen flex-1 flex-col">
        {/* Header */}
        <div className="bg-background/80 sticky top-0 z-10 flex items-center justify-between px-4 pb-3 pt-12 backdrop-blur-lg">
          <h1 className="text-2xl font-bold">Groceries</h1>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setStoreManagerOpen(true)}
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Grocery list */}
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <GroceryList
            groceries={groceries}
            recurringGroceries={recurringGroceries}
            stores={stores}
            onAssignToStore={handleAssignToStore}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onToggle={handleToggle}
          />
        </div>

        {/* Centered add button */}
        <div className="fixed bottom-24 left-0 right-0 z-20 flex justify-center pb-safe">
          <Button
            className="shadow-lg px-6"
            color="primary"
            radius="full"
            startContent={<PlusIcon className="h-5 w-5" />}
            onPress={() => setAddGroceryPanelOpen(true)}
          >
            Add items
          </Button>
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
