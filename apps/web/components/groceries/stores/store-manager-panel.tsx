"use client";

import { useRef, useState } from "react";
import { DynamicHeroIcon } from "@/components/groceries/dynamic-hero-icon";
import { getStoreColorClasses } from "@/components/groceries/store-colors";
import Panel from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { useGroceriesQuery } from "@/hooks/groceries";
import { useStoresMutations } from "@/hooks/stores";
import { Bars3Icon } from "@heroicons/react/24/solid";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import type {
  SearchAddressOutcome,
  StoreColor,
  StoreDto,
  StoreSearchAddressResult,
} from "@norish/shared/contracts";
import { sortAisles } from "@norish/shared/lib/aisles";

import type { EditingStore } from "./store-editor-panel";
import { DeleteStoreModal } from "./delete-store-modal";
import { canSaveStore, StoreEditorPanel } from "./store-editor-panel";
import { storeLinkFields } from "./store-search-address-field";

interface StoreManagerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: StoreDto[];
}
/** What the shop said when its Search Address was last tried, if it was. */
type ShopCheck = { storeName: string; result: StoreSearchAddressResult | null };

/**
 * The household's Stores: a list to reorder, edit and delete, with the one
 * being added or edited in a panel of its own over it. What the shop
 * answered when a Store's link was last tried is said here, above the list,
 * once the editor has closed.
 */
export function StoreManagerPanel({ open, onOpenChange, stores }: StoreManagerPanelProps) {
  const { createStore, updateStore, deleteStore, reorderStores, checkSearchAddress } =
    useStoresMutations();
  const { groceries } = useGroceriesQuery();
  const t = useTranslations("groceries.storeManager");
  const tActions = useTranslations("common.actions");
  const [editingStore, setEditingStore] = useState<EditingStore | null>(null);
  const [shopCheck, setShopCheck] = useState<ShopCheck | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const dragConstraintsRef = useRef<HTMLDivElement>(null);
  const handleStartCreate = () => {
    setEditingStore({
      id: null,
      name: "",
      color: "primary",
      icon: "ShoppingBagIcon",
      link: "",
      aisles: [],
    });
  };
  const handleStartEdit = (store: StoreDto) => {
    setEditingStore({
      id: store.id,
      name: store.name,
      color: store.color as StoreColor,
      icon: store.icon,
      link: store.searchAddress ?? store.website ?? "",
      aisles: sortAisles(store.aisles).map(({ id, name }) => ({ id, name })),
    });
  };
  const handleSave = async () => {
    if (!editingStore || !canSaveStore(editingStore)) return;

    const { website, searchAddress, term } = storeLinkFields(editingStore.link);
    const storeName = editingStore.name.trim();
    // Re-saving a Store with the link it already had asks the shop nothing:
    // the address was checked when it was pasted, and a paste re-read from the
    // Store carries no term to check it with.
    const before = editingStore.id ? stores.find((store) => store.id === editingStore.id) : null;
    const linkChanged =
      !before ||
      (before.website ?? null) !== website ||
      (before.searchAddress ?? null) !== searchAddress;

    let savedId = editingStore.id;
    // The whole list, in order: the aisles are saved with the Store, in one write.
    const aisles = editingStore.aisles.map(({ id, name }) => ({ id, name: name.trim() }));

    if (editingStore.id) {
      updateStore({
        id: editingStore.id,
        name: storeName,
        color: editingStore.color,
        icon: editingStore.icon,
        website,
        searchAddress,
        aisles,
      });
    } else {
      savedId = await createStore({
        name: storeName,
        color: editingStore.color,
        icon: editingStore.icon,
        website,
        searchAddress,
        aisles,
      });
    }
    setEditingStore(null);
    // Verification informs, it never gates: the Store is stored by now, and
    // this only tells the user what the address it was given actually found.
    if (savedId && (website ?? searchAddress) && linkChanged) {
      setShopCheck({ storeName, result: null });
      checkSearchAddress(savedId, term, searchAddress, website)
        .then((result) => setShopCheck({ storeName, result }))
        .catch(() => setShopCheck(null));
    }
  };
  const handleCancel = () => {
    setEditingStore(null);
  };
  const handleDeleteClick = (store: StoreDto) => {
    setStoreToDelete({
      id: store.id,
      name: store.name,
    });
    setDeleteModalOpen(true);
  };
  const handleDeleteConfirm = (storeId: string, deleteGroceries: boolean) => {
    const grocerySnapshot = groceries
      .filter((grocery) => grocery.storeId === storeId)
      .map((grocery) => ({
        id: grocery.id,
        version: grocery.version,
      }));

    deleteStore(storeId, deleteGroceries, grocerySnapshot);
    setStoreToDelete(null);
  };
  const handleReorder = (newOrder: StoreDto[]) => {
    reorderStores(newOrder.map((s) => s.id));
  };
  const handlePanelOpenChange = (isOpen: boolean) => {
    if (!isOpen) setEditingStore(null);
    onOpenChange(isOpen);
  };

  return (
    <>
      <Panel open={open} title={t("title")} onOpenChange={handlePanelOpenChange}>
        <Panel.Body>
          {shopCheck && <ShopCheckLine check={shopCheck} />}

          {/* Store list */}
          <div ref={dragConstraintsRef} className="min-h-0 flex-1">
            {stores.length === 0 && (
              <div className="text-muted py-8 text-center">
                <p>{t("noStoresYet")}</p>
                <p className="text-sm">{t("createStoreHint")}</p>
              </div>
            )}

            <Reorder.Group
              axis="y"
              className="flex flex-col gap-2"
              values={stores}
              onReorder={handleReorder}
            >
              {stores.map((store) => (
                <StoreListItem
                  key={store.id}
                  dragConstraintsRef={dragConstraintsRef}
                  store={store}
                  translations={{
                    deleteLabel: tActions("delete"),
                    editLabel: tActions("edit"),
                  }}
                  onDelete={() => handleDeleteClick(store)}
                  onEdit={() => handleStartEdit(store)}
                />
              ))}
            </Reorder.Group>
          </div>
        </Panel.Body>
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton action="add" onPress={handleStartCreate}>
              {t("addStore")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>

        <StoreEditorPanel
          editing={editingStore}
          open={open && editingStore !== null}
          onCancel={handleCancel}
          onChange={setEditingStore}
          onSave={handleSave}
        />
      </Panel>

      <DeleteStoreModal
        isOpen={deleteModalOpen}
        storeId={storeToDelete?.id ?? null}
        storeName={storeToDelete?.name ?? ""}
        onClose={() => {
          setDeleteModalOpen(false);
          setStoreToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

/** One line of copy per thing a shop can answer, so no outcome goes unworded. */
const CHECK_MESSAGES: Record<SearchAddressOutcome, string> = {
  products: "checkFoundProducts",
  "no-products": "checkNoProducts",
  answered: "checkAnswered",
  "no-answer": "checkNoAnswer",
  "no-address": "checkNoAddress",
};

/** What the shop answered, in the user's own words rather than an error. */
function ShopCheckLine({ check }: { check: ShopCheck }) {
  const t = useTranslations("groceries.storeManager");
  const { result } = check;
  const message = result
    ? t(CHECK_MESSAGES[result.outcome], { store: check.storeName, count: result.count ?? 0 })
    : t("checkingShop", { store: check.storeName });

  return (
    <p
      className="text-muted bg-surface-secondary mb-2 rounded-lg p-3 text-sm"
      data-testid="shop-check"
    >
      {message}
    </p>
  );
}

interface StoreListItemProps {
  store: StoreDto;
  dragConstraintsRef: React.RefObject<HTMLDivElement | null>;
  translations: {
    deleteLabel: string;
    editLabel: string;
  };
  onEdit: () => void;
  onDelete: () => void;
}
function StoreListItem({
  store,
  dragConstraintsRef,
  translations,
  onEdit,
  onDelete,
}: StoreListItemProps) {
  const controls = useDragControls();
  const colorClasses = getStoreColorClasses(store.color as StoreColor);

  return (
    <Reorder.Item
      className="bg-surface flex items-center gap-3 rounded-lg p-3"
      drag="y"
      dragConstraints={dragConstraintsRef}
      dragControls={controls}
      dragElastic={0}
      dragListener={false}
      dragMomentum={false}
      style={{
        position: "relative",
      }}
      value={store}
    >
      {/* Drag handle */}
      <div
        className="text-muted shrink-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
      >
        <Bars3Icon className="h-5 w-5" />
      </div>

      {/* Icon with color */}
      <div className={`shrink-0 rounded-full p-1.5 ${colorClasses.bgLight}`}>
        <DynamicHeroIcon className={`h-5 w-5 ${colorClasses.text}`} iconName={store.icon} />
      </div>

      {/* Name */}
      <span className="flex-1 truncate font-medium">{store.name}</span>

      {/* Actions */}
      <div className="flex shrink-0 gap-1">
        <IconActionButton action="edit" label={translations.editLabel} size="sm" onPress={onEdit} />
        <IconActionButton
          action="delete"
          label={translations.deleteLabel}
          size="sm"
          onPress={onDelete}
        />
      </div>
    </Reorder.Item>
  );
}
