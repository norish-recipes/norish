"use client";

import { GroceryList, GroceryListByRecipe, StoreManagerPanel } from "@/components/groceries";
import { AddGroceryPanel } from "@/components/Panel/consumers";
import EditGroceryPanel from "@/components/Panel/consumers/edit-grocery-panel";
import UiSwitch from "@/components/shared/ui-switch";
import GrocerySkeleton from "@/components/skeleton/grocery-skeleton";
import {
  BookOpenIcon,
  BuildingStorefrontIcon,
  CheckIcon,
  Cog6ToothIcon,
  PlusIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Header, Label, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { GroceryDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";

import { useGroceriesContext, useGroceriesUiContext } from "../context";
import { useStoresContext } from "../stores-context";
import AddGroceryButton from "./add-grocery-button";

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
  } = useGroceriesUiContext();
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
      // Convert regular grocery to recurring without racing an update against the delete.
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
              className="hidden rounded-full font-medium md:flex"
              size="md"
              onPress={() => setAddGroceryPanelOpen(true)}
              variant="primary"
            >
              {<PlusIcon className="h-5 w-5" />}
              {t("addItem")}
            </Button>
            {/* Settings dropdown with view mode and store management */}
            <Dropdown>
              <Button isIconOnly aria-label={t("viewMode")} size="sm" variant="tertiary">
                <Cog6ToothIcon className="h-5 w-5" />
              </Button>
              <Dropdown.Popover className="bg-overlay">
                <Dropdown.Menu aria-label={t("viewMode")}>
                  <Dropdown.Section>
                    <Header>{t("viewMode")}</Header>
                    <Dropdown.Item
                      id="view-store"
                      key="view-store"
                      textValue={t("viewByStore")}
                      onPress={() => setViewMode("store")}
                    >
                      {<BuildingStorefrontIcon className="h-4 w-4" />}
                      <Label>{t("viewByStore")}</Label>
                      {viewMode === "store" ? <CheckIcon className="text-accent h-4 w-4" /> : null}
                    </Dropdown.Item>
                    <Dropdown.Item
                      id="view-recipe"
                      key="view-recipe"
                      textValue={t("viewByRecipe")}
                      onPress={() => setViewMode("recipe")}
                    >
                      {<BookOpenIcon className="h-4 w-4" />}
                      <Label>{t("viewByRecipe")}</Label>
                      {viewMode === "recipe" ? <CheckIcon className="text-accent h-4 w-4" /> : null}
                    </Dropdown.Item>
                  </Dropdown.Section>
                  <Separator />
                  <Dropdown.Section className={viewMode !== "store" ? "hidden" : undefined}>
                    <Header>{t("storeViewOptions")}</Header>
                    <Dropdown.Item
                      id="group-similar"
                      key="group-similar"
                      textValue={t("groupIngredients")}
                      onPress={() => setGroupSimilarIngredients(!groupSimilarIngredients)}
                    >
                      <Label>{t("groupIngredients")}</Label>
                      {
                        <UiSwitch
                          aria-label={t("groupIngredients")}
                          isSelected={groupSimilarIngredients}
                          size="sm"
                          onValueChange={setGroupSimilarIngredients}
                        />
                      }
                    </Dropdown.Item>
                  </Dropdown.Section>
                  {viewMode === "store" ? <Separator /> : null}
                  <Dropdown.Section>
                    <Dropdown.Item
                      id="manage-stores"
                      key="manage-stores"
                      textValue={t("manageStores")}
                      onPress={() => setStoreManagerOpen(true)}
                    >
                      {<Cog6ToothIcon className="h-4 w-4" />}
                      <Label>{t("manageStores")}</Label>
                    </Dropdown.Item>
                  </Dropdown.Section>
                </Dropdown.Menu>
              </Dropdown.Popover>
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
