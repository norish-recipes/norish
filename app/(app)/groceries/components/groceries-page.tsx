"use client";

import type { GroceryDto } from "@/types";
import type { RecurrencePattern } from "@/types/recurrence";

import { Button } from "@heroui/react";
import { PlusIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";

import { useGroceriesContext, useGroceriesUIContext } from "../context";
import { useStoresContext } from "../stores-context";
import { GroceryList, StoreManagerPanel } from "@/components/groceries";
import AddGroceryPanel from "@/components/Panel/consumers/add-grocery-panel";
import EditGroceryPanel from "@/components/Panel/consumers/edit-grocery-panel";
import GrocerySkeleton from "@/components/skeleton/grocery-skeleton";

export function GroceriesPage() {
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
      // Convert regular grocery to recurring
      updateGrocery(editingGrocery.id, itemName);
      createRecurringGrocery(itemName, pattern, editingGrocery.storeId);
      deleteGroceries([editingGrocery.id]);
    } else {
      // Simple update
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
    return <GrocerySkeleton />;
  }

  return (
    <>
      {/* Mobile: Full screen breakout layout */}
      {/* Desktop: Contained layout with max-width */}
      <div className="-mx-6 -mt-10 flex min-h-0 w-screen flex-1 flex-col md:mx-auto md:mt-0 md:w-full md:max-w-7xl md:gap-6 md:p-6">
        {/* Header */}
        {/* Mobile: Sticky with backdrop blur */}
        {/* Desktop: Static with inline layout */}
        <div className="bg-background/80 sticky top-0 z-10 flex items-center justify-between px-4 pb-3 pt-12 backdrop-blur-lg md:static md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none">
          <h1 className="text-2xl font-bold">Groceries</h1>
          <div className="flex items-center gap-2">
            {/* Desktop add button: Full text with icon */}
            <Button
              className="hidden md:flex"
              color="primary"
              startContent={<PlusIcon className="h-5 w-5" />}
              onPress={() => setAddGroceryPanelOpen(true)}
            >
              Add Item
            </Button>
            {/* Settings button: Different sizes and variants */}
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="md:size-auto md:variant-flat"
              onPress={() => setStoreManagerOpen(true)}
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Grocery list */}
        {/* Mobile: Padding for fixed add button */}
        {/* Desktop: Standard overflow */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 md:px-0 md:pb-0">
          <GroceryList
            groceries={groceries}
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

        {/* Mobile: Centered floating add button at bottom */}
        <div className="fixed bottom-24 left-0 right-0 z-20 flex justify-center pb-safe md:hidden">
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
