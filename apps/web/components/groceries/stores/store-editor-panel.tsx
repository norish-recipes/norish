"use client";

import { DynamicHeroIcon, STORE_ICON_NAMES } from "@/components/groceries/dynamic-hero-icon";
import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import { getStoreColorClasses, STORE_COLOR_OPTIONS } from "@/components/groceries/store-colors";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Input, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { StoreColor } from "@norish/shared/contracts";
import { duplicateAisleName } from "@norish/shared/lib/aisles";
import { deriveSearchAddress } from "@norish/shared/lib/search-address";

import type { EditingAisle } from "./store-aisles-editor";
import { AISLE_NAME_MAX, StoreAislesEditor } from "./store-aisles-editor";
import { StoreSearchAddressField } from "./store-search-address-field";

export type { EditingAisle } from "./store-aisles-editor";

/** A Store as it is being typed: a new one where `id` is null. */
export interface EditingStore {
  id: string | null;
  name: string;
  color: StoreColor;
  icon: string;
  /** What the user pasted: the shop's website, or a search they ran there. */
  link: string;
  /** The Store's aisles, in the order the household walks them. */
  aisles: EditingAisle[];
}

/**
 * Whether the form can be saved: a name, a shop link that is either empty or
 * one Norish can read, and aisles that each have a name of their own. A link
 * Norish cannot read would be saved as no link at all, silently taking the
 * Store's website and Search Address with it; two aisles on one name would
 * be refused by the server, so Save waits here instead.
 */
export function canSaveStore(editing: EditingStore): boolean {
  const link = editing.link.trim();
  const aisleNames = editing.aisles.map((aisle) => aisle.name);

  return (
    editing.name.trim() !== "" &&
    (link === "" || deriveSearchAddress(link) !== null) &&
    aisleNames.every((name) => name.trim() !== "" && name.trim().length <= AISLE_NAME_MAX) &&
    duplicateAisleName(aisleNames) === null
  );
}

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
      className="contents"
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
              // eslint-disable-next-line jsx-a11y/no-autofocus
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
                {STORE_COLOR_OPTIONS.map((color) => {
                  const colorClasses = getStoreColorClasses(color);
                  const isSelected = editing.color === color;

                  return (
                    <button
                      key={color}
                      aria-label={color}
                      aria-pressed={isSelected}
                      className={`h-8 w-8 rounded-full transition-transform ${colorClasses.bg} ${isSelected ? "scale-110 ring-2 ring-offset-2" : ""} ${colorClasses.ring}`}
                      type="button"
                      onClick={() => onChange({ ...editing, color })}
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
                      aria-label={iconName}
                      aria-pressed={isSelected}
                      className={`rounded-lg p-2 transition-colors ${isSelected ? `${colorClasses.bgLight} ${colorClasses.text}` : "bg-surface-secondary text-muted hover:bg-surface-tertiary"}`}
                      type="button"
                      onClick={() => onChange({ ...editing, icon: iconName })}
                    >
                      <DynamicHeroIcon className="h-5 w-5" iconName={iconName} />
                    </button>
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
