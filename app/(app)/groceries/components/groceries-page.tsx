"use client";

import type { GroceryDto } from "@/types";
import type { RecurrencePattern } from "@/types/recurrence";

import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
  Switch,
} from "@heroui/react";
import {
  PlusIcon,
  Cog6ToothIcon,
  BuildingStorefrontIcon,
  BookOpenIcon,
  CheckIcon,
} from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useGroceriesContext, useGroceriesUIContext } from "../context";
import { useStoresContext } from "../stores-context";

import AddGroceryButton from "./add-grocery-button";

import { GroceryList, GroceryListByRecipe, StoreManagerPanel } from "@/components/groceries";
import EditGroceryPanel from "@/components/Panel/consumers/edit-grocery-panel";
import { AddGroceryPanel } from "@/components/Panel/consumers";
import GrocerySkeleton from "@/components/skeleton/grocery-skeleton";

export function GroceriesPage() {
  const {
    groceries,
    recurringGroceries,
    recipeMap,
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
    getRecipeNameForGrocery,
  } = useGroceriesContext();

  const { stores, storeManagerOpen, setStoreManagerOpen } = useStoresContext();

  const {
    addGroceryPanelOpen,
    setAddGroceryPanelOpen,
    editingGrocery,
    setEditingGrocery,
    viewMode,
    setViewMode,
    groupSimilarIngredients,
    setGroupSimilarIngredients,
  } = useGroceriesUIContext();

  const t = useTranslations("groceries.page");

  const handleToggle = (id: string, isDone: boolean) => {
    toggleGroceries([id], isDone);
  };

  const handleToggleGroup = (ids: string[], isDone: boolean) => {
    toggleGroceries(ids, isDone);
  };

  const handleEdit = (grocery: GroceryDto) => {
    setEditingGrocery(grocery);
  };

  const handleDelete = (id: string) => {
    deleteGroceries([id]);
  };

  // Edit panel handlers
  const editingRecurringGrocery = editingGrocery
    ? getRecurringGroceryForGrocery(editingGrocery.id)
    : null;

  const handleEditSave = (itemName: string, pattern: RecurrencePattern | null) => {
    if (!editingGrocery) return;

    if (editingRecurringGrocery) {
      // Already recurring - update the recurring grocery
      updateRecurringGrocery(editingRecurringGrocery.id, editingGrocery.id, itemName, pattern);
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
      <div className="flex min-h-0 w-full flex-1 flex-col">
        {/* Header */}
        <div className="mb-6 flex min-h-10 shrink-0 items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-2">
            {/* Desktop add button: Full text with icon */}
            <Button
              className="hidden font-medium md:flex"
              color="primary"
              radius="full"
              size="md"
              startContent={<PlusIcon className="h-5 w-5" />}
              onPress={() => setAddGroceryPanelOpen(true)}
            >
              {t("addItem")}
            </Button>
            {/* Settings dropdown with view mode and store management */}
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly aria-label={t("viewMode")} size="sm" variant="light">
                  <Cog6ToothIcon className="h-5 w-5" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label={t("viewMode")}>
                <DropdownSection showDivider title={t("viewMode")}>
                  <DropdownItem
                    key="view-store"
                    endContent={
                      viewMode === "store" ? <CheckIcon className="text-primary h-4 w-4" /> : null
                    }
                    startContent={<BuildingStorefrontIcon className="h-4 w-4" />}
                    onPress={() => setViewMode("store")}
                  >
                    {t("viewByStore")}
                  </DropdownItem>
                  <DropdownItem
                    key="view-recipe"
                    endContent={
                      viewMode === "recipe" ? <CheckIcon className="text-primary h-4 w-4" /> : null
                    }
                    startContent={<BookOpenIcon className="h-4 w-4" />}
                    onPress={() => setViewMode("recipe")}
                  >
                    {t("viewByRecipe")}
                  </DropdownItem>
                </DropdownSection>
                <DropdownSection
                  showDivider
                  className={viewMode !== "store" ? "hidden" : undefined}
                  title={t("storeViewOptions")}
                >
                  <DropdownItem
                    key="group-similar"
                    closeOnSelect={false}
                    endContent={
                      <Switch
                        aria-label={t("groupIngredients")}
                        isSelected={groupSimilarIngredients}
                        size="sm"
                        onValueChange={setGroupSimilarIngredients}
                      />
                    }
                    onPress={() => setGroupSimilarIngredients(!groupSimilarIngredients)}
                  >
                    {t("groupIngredients")}
                  </DropdownItem>
                </DropdownSection>
                <DropdownSection>
                  <DropdownItem
                    key="manage-stores"
                    startContent={<Cog6ToothIcon className="h-4 w-4" />}
                    onPress={() => setStoreManagerOpen(true)}
                  >
                    {t("manageStores")}
                  </DropdownItem>
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        {/* Grocery list */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "store" ? (
            <GroceryList
              getRecipeNameForGrocery={getRecipeNameForGrocery}
              groceries={groceries}
              groupSimilarIngredients={groupSimilarIngredients}
              recurringGroceries={recurringGroceries}
              stores={stores}
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
              onDelete={handleDelete}
              onEdit={handleEdit}
              onReorder={reorderGroceriesInStore}
              onToggle={handleToggle}
            />
          )}
        </div>

        {/* Mobile: Floating add button that syncs with nav auto-hide */}
        <AddGroceryButton />
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
