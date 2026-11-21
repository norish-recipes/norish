"use client";

import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { FIELD_CLASS, FIELD_STYLE } from "@/features/groceries/lib/grocery-field";
import { Input, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { EditingStore } from "@norish/shared-react/groceries";
import { canSaveStore } from "@norish/shared-react/groceries";

import { StoreAislesEditor } from "./store-aisles-editor";
import { STORE_COLOR_KEYS, storeColorStyle, storeHue } from "./store-colors";
import { StoreSearchAddressField } from "./store-search-address-field";

interface StoreEditorPanelProps {
  open: boolean;
  editing: EditingStore | null;
  onChange: (store: EditingStore) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * The Store being added or edited, in a panel of its own over the list, the
 * way every editor in the app opens: the list stays where it was, and the
 * panel's own footer saves or lets go. Nothing here writes anything; the
 * manager does, on Save.
 */
export function StoreEditorPanel({
  open,
  editing,
  onChange,
  onSave,
  onCancel,
}: StoreEditorPanelProps) {
  const t = useTranslations("groceries.storeManager");
  const tActions = useTranslations("common.actions");

  return (
    <Panel
      nested
      open={open && editing !== null}
      title={editing?.id ? t("editStore") : t("addStore")}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <Panel.Body>
        {editing && (
          <div className="flex flex-col gap-4">
            <TextField
              // eslint-disable-next-line jsx-a11y-x/no-autofocus
              autoFocus
              value={editing.name}
              onChange={(value) => onChange({ ...editing, name: value })}
            >
              <Label>{t("storeName")}</Label>
              <Input
                className={FIELD_CLASS}
                data-testid="store-name"
                placeholder={t("storeNamePlaceholder")}
                style={FIELD_STYLE}
                variant="secondary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSave();
                  }
                }}
              />
            </TextField>

            {/* The shop this store stands for, from one pasted link */}
            <StoreSearchAddressField
              value={editing.link}
              onChange={(link) => onChange({ ...editing, link })}
            />

            {/* Color picker */}
            <div>
              <p className="text-muted mb-2 text-sm font-medium">{t("storeColor")}</p>
              <div className="flex flex-wrap gap-2">
                {STORE_COLOR_KEYS.map((color) => {
                  const isSelected = editing.color === color;

                  return (
                    <button
                      key={color}
                      aria-label={t(`colorNames.${storeHue(color).name}`)}
                      aria-pressed={isSelected}
                      className={`h-8 w-8 rounded-full bg-(--store-color) ring-(--store-color) transition-transform ${isSelected ? "scale-110 ring-2 ring-offset-2" : ""}`}
                      style={storeColorStyle(color)}
                      type="button"
                      onClick={() => onChange({ ...editing, color })}
                    />
                  );
                })}
              </div>
            </div>

            {/* The aisles of the shop, in the order the household walks them */}
            <StoreAislesEditor
              aisles={editing.aisles}
              open={open}
              onChange={(aisles) => onChange({ ...editing, aisles })}
            />
          </div>
        )}
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="cancel" onPress={onCancel}>
            {tActions("cancel")}
          </ActionButton>
          <ActionButton
            action={editing?.id ? "save" : "create"}
            isDisabled={!editing || !canSaveStore(editing)}
            onPress={onSave}
          >
            {editing?.id ? tActions("save") : t("create")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
