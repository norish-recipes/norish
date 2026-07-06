"use client";

import { useRef, useState } from "react";
import { DynamicHeroIcon, STORE_ICON_NAMES } from "@/components/groceries/dynamic-hero-icon";
import { getStoreColorClasses, STORE_COLOR_OPTIONS } from "@/components/groceries/store-colors";
import Panel from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { useGroceriesQuery } from "@/hooks/groceries";
import { useStoresMutations } from "@/hooks/stores";
import { Bars3Icon } from "@heroicons/react/24/solid";
import { Input, Label, TextField } from "@heroui/react";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import type { StoreColor, StoreDto } from "@norish/shared/contracts";

import { DeleteStoreModal } from "./delete-store-modal";

interface StoreManagerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: StoreDto[];
}
type EditingStore = {
  id: string | null; // null = new store
  name: string;
  color: StoreColor;
  icon: string;
};
export function StoreManagerPanel({ open, onOpenChange, stores }: StoreManagerPanelProps) {
  const { createStore, updateStore, deleteStore, reorderStores } = useStoresMutations();
  const { groceries } = useGroceriesQuery();
  const t = useTranslations("groceries.storeManager");
  const tActions = useTranslations("common.actions");
  const [editingStore, setEditingStore] = useState<EditingStore | null>(null);
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
    });
  };
  const handleStartEdit = (store: StoreDto) => {
    setEditingStore({
      id: store.id,
      name: store.name,
      color: store.color as StoreColor,
      icon: store.icon,
    });
  };
  const handleSave = async () => {
    if (!editingStore || !editingStore.name.trim()) return;
    if (editingStore.id) {
      // Update existing store
      updateStore({
        id: editingStore.id,
        name: editingStore.name.trim(),
        color: editingStore.color,
        icon: editingStore.icon,
      });
    } else {
      // Create new store
      await createStore({
        name: editingStore.name.trim(),
        color: editingStore.color,
        icon: editingStore.icon,
      });
    }
    setEditingStore(null);
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
    const storeIds = newOrder.map((s) => s.id);
    reorderStores(storeIds);
  };
  return (
    <>
      <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
        <Panel.Body>
          {/* Store list */}
          <div ref={dragConstraintsRef} className="min-h-0 flex-1">
            {stores.length === 0 && !editingStore && (
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
                  isEditing={editingStore?.id === store.id}
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

            {/* New store form inline */}
            {editingStore && editingStore.id === null && (
              <div className="mt-2">
                <StoreEditForm
                  editing={editingStore}
                  translations={{
                    t,
                    tActions,
                  }}
                  onCancel={handleCancel}
                  onChange={setEditingStore}
                  onSave={handleSave}
                />
              </div>
            )}
          </div>

          {/* Edit form when editing existing store */}
          {editingStore && editingStore.id !== null && (
            <div className="border-border border-t pt-4">
              <StoreEditForm
                editing={editingStore}
                translations={{
                  t,
                  tActions,
                }}
                onCancel={handleCancel}
                onChange={setEditingStore}
                onSave={handleSave}
              />
            </div>
          )}
        </Panel.Body>
        {!editingStore && (
          <Panel.Footer>
            <ActionButtonGroup>
              <ActionButton action="add" onPress={handleStartCreate}>
                {t("addStore")}
              </ActionButton>
            </ActionButtonGroup>
          </Panel.Footer>
        )}
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

// Store list item component
interface StoreListItemProps {
  store: StoreDto;
  isEditing: boolean;
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
  isEditing,
  dragConstraintsRef,
  translations,
  onEdit,
  onDelete,
}: StoreListItemProps) {
  const controls = useDragControls();
  const colorClasses = getStoreColorClasses(store.color as StoreColor);
  if (isEditing) {
    return null; // Hide when editing (form shows below)
  }
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

// Store edit form component
interface StoreEditFormProps {
  editing: EditingStore;
  onChange: (store: EditingStore) => void;
  onSave: () => void;
  onCancel: () => void;
  translations: {
    t: ReturnType<typeof useTranslations<"groceries.storeManager">>;
    tActions: ReturnType<typeof useTranslations<"common.actions">>;
  };
}
function StoreEditForm({ editing, onChange, onSave, onCancel, translations }: StoreEditFormProps) {
  const { t, tActions } = translations;
  return (
    <div className="bg-surface-secondary flex flex-col gap-4 rounded-lg p-4">
      {/* Name input - autoFocus is intentional UX for edit form */}
      <TextField
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={editing.name}
        onChange={(value) =>
          onChange({
            ...editing,
            name: value,
          })
        }
      >
        <Label>{t("storeName")}</Label>
        <Input
          variant="secondary"
          placeholder={t("storeNamePlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
          }}
        />
      </TextField>

      {/* Color picker */}
      <div>
        <p className="text-muted mb-2 text-sm font-medium">{t("storeColor")}</p>
        <div className="flex flex-wrap gap-2">
          {STORE_COLOR_OPTIONS.map((color) => {
            const colorClasses = getStoreColorClasses(color);
            const isSelected = editing.color === color;
            return (
              <button
                key={color}
                className={`h-8 w-8 rounded-full transition-transform ${colorClasses.bg} ${isSelected ? "scale-110 ring-2 ring-offset-2" : ""} ${colorClasses.ring}`}
                type="button"
                onClick={() =>
                  onChange({
                    ...editing,
                    color,
                  })
                }
              />
            );
          })}
        </div>
      </div>

      {/* Icon picker */}
      <div>
        <p className="text-muted mb-2 text-sm font-medium">{t("storeIcon")}</p>
        <div className="flex flex-wrap gap-2">
          {STORE_ICON_NAMES.map((iconName) => {
            const isSelected = editing.icon === iconName;
            const colorClasses = getStoreColorClasses(editing.color);
            return (
              <button
                key={iconName}
                className={`rounded-lg p-2 transition-colors ${isSelected ? `${colorClasses.bgLight} ${colorClasses.text}` : "bg-surface text-muted hover:bg-surface-tertiary"}`}
                type="button"
                onClick={() =>
                  onChange({
                    ...editing,
                    icon: iconName,
                  })
                }
              >
                <DynamicHeroIcon className="h-5 w-5" iconName={iconName} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <ActionButtonGroup>
        <ActionButton action="cancel" onPress={onCancel}>
          {tActions("cancel")}
        </ActionButton>
        <ActionButton
          action={editing.id ? "save" : "create"}
          isDisabled={!editing.name.trim()}
          onPress={onSave}
        >
          {editing.id ? tActions("save") : t("create")}
        </ActionButton>
      </ActionButtonGroup>
    </div>
  );
}
