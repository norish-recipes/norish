"use client";

import type { StoreDto, StoreColor } from "@/types";

import { useState, useRef } from "react";
import { Button, Input } from "@heroui/react";
import { Reorder, useDragControls } from "motion/react";
import {
  Bars3Icon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { useTranslations } from "next-intl";

import { DeleteStoreModal } from "./delete-store-modal";

import Panel, { PANEL_HEIGHT_LARGE } from "@/components/Panel/Panel";
import { DynamicHeroIcon, STORE_ICON_NAMES } from "@/components/groceries/dynamic-hero-icon";
import { STORE_COLOR_OPTIONS, getStoreColorClasses } from "@/components/groceries/store-colors";
import { useStoresMutations } from "@/hooks/stores";

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
  const t = useTranslations("groceries.storeManager");
  const tActions = useTranslations("common.actions");

  const [editingStore, setEditingStore] = useState<EditingStore | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<{ id: string; name: string } | null>(null);

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
    setStoreToDelete({ id: store.id, name: store.name });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = (storeId: string, deleteGroceries: boolean) => {
    deleteStore(storeId, deleteGroceries);
    setStoreToDelete(null);
  };

  const handleReorder = (newOrder: StoreDto[]) => {
    const storeIds = newOrder.map((s) => s.id);

    reorderStores(storeIds);
  };

  return (
    <>
      <Panel height={PANEL_HEIGHT_LARGE} open={open} title={t("title")} onOpenChange={onOpenChange}>
        <div className="flex h-full flex-col gap-4">
          {/* Store list */}
          <div ref={dragConstraintsRef} className="flex-1 overflow-y-auto">
            {stores.length === 0 && !editingStore && (
              <div className="text-default-400 py-8 text-center">
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
                  translations={{ t, tActions }}
                  onCancel={handleCancel}
                  onChange={setEditingStore}
                  onSave={handleSave}
                />
              </div>
            )}
          </div>

          {/* Edit form when editing existing store */}
          {editingStore && editingStore.id !== null && (
            <div className="border-default-200 border-t pt-4">
              <StoreEditForm
                editing={editingStore}
                translations={{ t, tActions }}
                onCancel={handleCancel}
                onChange={setEditingStore}
                onSave={handleSave}
              />
            </div>
          )}

          {/* Add store button */}
          {!editingStore && (
            <Button
              className="shrink-0"
              color="primary"
              startContent={<PlusIcon className="h-5 w-5" />}
              variant="solid"
              onPress={handleStartCreate}
            >
              {t("addStore")}
            </Button>
          )}
        </div>
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
  onEdit: () => void;
  onDelete: () => void;
}

function StoreListItem({
  store,
  isEditing,
  dragConstraintsRef,
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
      className="bg-content1 flex items-center gap-3 rounded-lg p-3"
      drag="y"
      dragConstraints={dragConstraintsRef}
      dragControls={controls}
      dragElastic={0}
      dragListener={false}
      dragMomentum={false}
      style={{ position: "relative" }}
      value={store}
    >
      {/* Drag handle */}
      <div
        className="text-default-400 shrink-0 cursor-grab touch-none active:cursor-grabbing"
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
        <Button isIconOnly size="sm" variant="light" onPress={onEdit}>
          <PencilIcon className="h-4 w-4" />
        </Button>
        <Button isIconOnly color="danger" size="sm" variant="light" onPress={onDelete}>
          <TrashIcon className="h-4 w-4" />
        </Button>
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
    <div className="bg-content2 flex flex-col gap-4 rounded-lg p-4">
      {/* Name input - autoFocus is intentional UX for edit form */}
      <Input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        label={t("storeName")}
        placeholder={t("storeNamePlaceholder")}
        size="sm"
        value={editing.name}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave();
          }
        }}
        onValueChange={(v) => onChange({ ...editing, name: v })}
      />

      {/* Color picker */}
      <div>
        <p className="text-default-600 mb-2 text-sm font-medium">{t("storeColor")}</p>
        <div className="flex flex-wrap gap-2">
          {STORE_COLOR_OPTIONS.map((color) => {
            const colorClasses = getStoreColorClasses(color);
            const isSelected = editing.color === color;

            return (
              <button
                key={color}
                className={`h-8 w-8 rounded-full transition-transform ${colorClasses.bg} ${
                  isSelected ? "scale-110 ring-2 ring-offset-2" : ""
                } ${colorClasses.ring}`}
                type="button"
                onClick={() => onChange({ ...editing, color })}
              />
            );
          })}
        </div>
      </div>

      {/* Icon picker */}
      <div>
        <p className="text-default-600 mb-2 text-sm font-medium">{t("storeIcon")}</p>
        <div className="flex flex-wrap gap-2">
          {STORE_ICON_NAMES.map((iconName) => {
            const isSelected = editing.icon === iconName;
            const colorClasses = getStoreColorClasses(editing.color);

            return (
              <button
                key={iconName}
                className={`rounded-lg p-2 transition-colors ${
                  isSelected
                    ? `${colorClasses.bgLight} ${colorClasses.text}`
                    : "bg-default-100 text-default-600 hover:bg-default-200"
                }`}
                type="button"
                onClick={() => onChange({ ...editing, icon: iconName })}
              >
                <DynamicHeroIcon className="h-5 w-5" iconName={iconName} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="flat" onPress={onCancel}>
          <XMarkIcon className="h-4 w-4" />
          {tActions("cancel")}
        </Button>
        <Button color="primary" isDisabled={!editing.name.trim()} size="sm" onPress={onSave}>
          <CheckIcon className="h-4 w-4" />
          {editing.id ? tActions("save") : t("create")}
        </Button>
      </div>
    </div>
  );
}
