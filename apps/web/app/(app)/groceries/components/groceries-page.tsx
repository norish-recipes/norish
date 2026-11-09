"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { GroceryList, GroceryListByRecipe, StoreManagerPanel } from "@/components/groceries";
import { ClearGroceriesModal } from "@/components/groceries/clear-groceries-modal";
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
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Header, Label, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import {
  useGroceriesMutations,
  useGroceriesQuery,
  useGroceriesUiStore,
  useGroceryIds,
  useRecurringGroceryFor,
  useStoresQuery,
} from "@norish/shared-react/groceries";
import { useDevicePreference } from "@norish/shared-react/reader";
import {
  cssFloatingDockContentClearance,
  cssHeaderControl,
  cssHeaderIcon,
  cssHeaderIconControl,
} from "@norish/web/config/css-tokens";

export function GroceriesPage() {
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
  const setEditingGrocery = useGroceriesUiStore((state) => state.setEditingGrocery);

  type ClearScope =
    | { kind: "store"; storeId: string | null; name: string }
    | { kind: "recipe"; ids: string[]; name: string };
  const [clearScope, setClearScope] = useState<ClearScope | null>(null);
  const clearIds =
    clearScope?.kind === "store"
      ? groceries.filter((g) => g.storeId === clearScope.storeId).map((g) => g.id)
      : (clearScope?.ids ?? []);
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
    setEditingGrocery(grocery);
  };
  const handleDelete = (id: string) => {
    deleteGroceries([id]);
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
              onClearAllInStore={(storeId, name) => setClearScope({ kind: "store", storeId, name })}
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

/** The edit panel, with its own saves: always mounted, so a save's answer lands after it closes. */
function EditGrocery({ stores }: { stores: StoreDto[] }) {
  const grocery = useGroceriesUiStore((state) => state.editingGrocery);
  const setEditingGrocery = useGroceriesUiStore((state) => state.setEditingGrocery);
  const recurringGrocery = useRecurringGroceryFor(grocery?.id ?? null);
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
    setEditingGrocery(null);
  };

  return (
    <EditGroceryPanel
      open
      grocery={grocery}
      recurringGrocery={recurringGrocery}
      stores={stores}
      onDelete={handleDelete}
      onOpenChange={(open) => !open && setEditingGrocery(null)}
      onSave={handleSave}
    />
  );
}

/**
 * The list view's own controls, on the right of the Groceries header: the
 * desktop add button and the menu with the view mode, grouping and stores.
 */
export function GroceriesListActions() {
  const groceryIds = useGroceryIds();
  const { deleteGroceries } = useGroceriesMutations();
  const [clearListOpen, setClearListOpen] = useState(false);
  const [viewMode, setViewMode] = useDevicePreference("groceryViewMode");
  const [groupSimilarIngredients, setGroupSimilarIngredients] =
    useDevicePreference("groceryGroupSimilar");
  const setAddGroceryPanelOpen = useGroceriesUiStore((state) => state.setAddGroceryPanelOpen);
  const setStoreManagerOpen = useGroceriesUiStore((state) => state.setStoreManagerOpen);
  const t = useTranslations("groceries.page");

  return (
    <>
      {/* Desktop add button: Full text with icon */}
      <Button
        className={`hidden rounded-full px-3 font-medium md:flex ${cssHeaderControl}`}
        size="md"
        variant="primary"
        onPress={() => setAddGroceryPanelOpen(true)}
      >
        {<PlusIcon className={cssHeaderIcon} />}
        {t("addItem")}
      </Button>
      {/* Settings dropdown with view mode and store management */}
      <Dropdown>
        <Button
          isIconOnly
          aria-label={t("viewMode")}
          className={cssHeaderIconControl}
          size="md"
          variant="tertiary"
        >
          <Cog6ToothIcon className={cssHeaderIcon} />
        </Button>
        <Dropdown.Popover className="bg-overlay">
          <Dropdown.Menu aria-label={t("viewMode")}>
            <Dropdown.Section>
              <Header>{t("viewMode")}</Header>
              <Dropdown.Item
                key="view-store"
                id="view-store"
                textValue={t("viewByStore")}
                onPress={() => setViewMode("store")}
              >
                {<BuildingStorefrontIcon className="h-4 w-4" />}
                <Label>{t("viewByStore")}</Label>
                {viewMode === "store" ? <CheckIcon className="text-accent h-4 w-4" /> : null}
              </Dropdown.Item>
              <Dropdown.Item
                key="view-recipe"
                id="view-recipe"
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
                key="group-similar"
                id="group-similar"
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
                key="manage-stores"
                id="manage-stores"
                textValue={t("manageStores")}
                onPress={() => setStoreManagerOpen(true)}
              >
                {<Cog6ToothIcon className="h-4 w-4" />}
                <Label>{t("manageStores")}</Label>
              </Dropdown.Item>
              {groceryIds.length > 0 && (
                <Dropdown.Item
                  key="clear-list"
                  className="text-danger"
                  id="clear-list"
                  textValue={t("clearList")}
                  variant="danger"
                  onPress={() => setClearListOpen(true)}
                >
                  {<TrashIcon className="h-4 w-4" />}
                  <Label>{t("clearList")}</Label>
                </Dropdown.Item>
              )}
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <ClearGroceriesModal
        isOpen={clearListOpen}
        itemCount={groceryIds.length}
        scopeName={null}
        onClose={() => setClearListOpen(false)}
        onConfirm={() => deleteGroceries(groceryIds)}
      />
    </>
  );
}
