"use client";

import { useRef, useState } from "react";
import Panel from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { Bars3Icon } from "@heroicons/react/24/solid";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import type { EditingStore, ShopCheck } from "@norish/shared-react/groceries";
import type { StoreDto } from "@norish/shared/contracts";
import {
  editingStoreOf,
  newEditingStore,
  SHOP_CHECK_MESSAGES,
  useSaveStore,
  useStoresMutations,
} from "@norish/shared-react/groceries";

import { DeleteStoreModal } from "./delete-store-modal";
import { storeColorStyle } from "./store-colors";
import { StoreEditorPanel } from "./store-editor-panel";

interface StoreManagerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: StoreDto[];
}
/**
 * The household's Stores: a list to reorder, edit and delete, with the one
 * being added or edited in a panel of its own over it. What the shop
 * answered when a Store's link was last tried is said here, above the list,
 * once the editor has closed.
 */
export function StoreManagerPanel({ open, onOpenChange, stores }: StoreManagerPanelProps) {
  const { deleteStore, reorderStores } = useStoresMutations();
  const { save, shopCheck } = useSaveStore(stores);
  const t = useTranslations("groceries.storeManager");
  const tActions = useTranslations("common.actions");
  const [editingStore, setEditingStore] = useState<EditingStore | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const dragConstraintsRef = useRef<HTMLDivElement>(null);
  const handleStartCreate = () => setEditingStore(newEditingStore());
  const handleStartEdit = (store: StoreDto) => setEditingStore(editingStoreOf(store));
  const handleSave = async () => {
    if (!editingStore) return;
    // A refused create leaves the editor open on its draft, so Save can try again.
    if (await save(editingStore)) setEditingStore(null);
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
    deleteStore(storeId, deleteGroceries);
    setStoreToDelete(null);
  };
  // The order while a Store is dragged, saved once it is let go: a write per
  // swap raced its own versions, and the list could settle on an earlier swap.
  const [draggedOrder, setDraggedOrder] = useState<StoreDto[] | null>(null);
  const shownStores = draggedOrder ?? stores;
  const handleDragEnd = () => {
    if (draggedOrder) reorderStores(draggedOrder.map((s) => s.id));
    setDraggedOrder(null);
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
              values={shownStores}
              onReorder={setDraggedOrder}
            >
              {shownStores.map((store) => (
                <StoreListItem
                  key={store.id}
                  dragConstraintsRef={dragConstraintsRef}
                  store={store}
                  translations={{
                    deleteLabel: tActions("delete"),
                    editLabel: tActions("edit"),
                  }}
                  onDelete={() => handleDeleteClick(store)}
                  onDragEnd={handleDragEnd}
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

/** What the shop answered, in the user's own words rather than an error. */
function ShopCheckLine({ check }: { check: ShopCheck }) {
  const t = useTranslations("groceries.storeManager");
  const { result } = check;
  const message = result
    ? t(SHOP_CHECK_MESSAGES[result.outcome], { store: check.storeName, count: result.count ?? 0 })
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
  onDragEnd: () => void;
}
function StoreListItem({
  store,
  dragConstraintsRef,
  translations,
  onEdit,
  onDelete,
  onDragEnd,
}: StoreListItemProps) {
  const controls = useDragControls();

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
      onDragEnd={onDragEnd}
    >
      {/* Drag handle */}
      <div
        className="text-muted shrink-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
      >
        <Bars3Icon className="h-5 w-5" />
      </div>

      {/* The Store's mark: a dot in its colour */}
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full bg-(--store-color)"
        data-testid="store-dot"
        style={storeColorStyle(store.color)}
      />

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
