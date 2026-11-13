"use client";

import { useState } from "react";
import UiSwitch from "@/components/shared/ui-switch";
import { ClearGroceriesModal } from "@/features/groceries/components/list/clear-groceries-modal";
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

import {
  useGroceriesMutations,
  useGroceriesUiStore,
  useGroceryIds,
  useHasGroceries,
} from "@norish/shared-react/groceries";
import { useDevicePreference } from "@norish/shared-react/reader";
import {
  cssHeaderControl,
  cssHeaderIcon,
  cssHeaderIconControl,
} from "@norish/web/config/css-tokens";

/**
 * The list view's own controls, on the right of the Groceries header: the
 * desktop add button and the menu with the view mode, grouping and stores.
 */
export function GroceriesListActions() {
  // A boolean, so an add or a removal doesn't re-render the menu.
  const hasGroceries = useHasGroceries();
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
              {hasGroceries && (
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
      <ClearList isOpen={clearListOpen} onClose={() => setClearListOpen(false)} />
    </>
  );
}

/** The whole list's clear modal, which reads the list's ids only while it is open. */
function ClearList({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const groceryIds = useGroceryIds(isOpen);
  const { deleteGroceries } = useGroceriesMutations();

  return (
    <ClearGroceriesModal
      isOpen={isOpen}
      itemCount={groceryIds.length}
      scopeName={null}
      onClose={onClose}
      onConfirm={() => deleteGroceries(groceryIds)}
    />
  );
}
