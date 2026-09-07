"use client";

import { useEffect, useState } from "react";
import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import { Bars3Icon, PlusIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button, FieldError, Input, TextField } from "@heroui/react";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import { duplicateAisleName, foldAisleName } from "@norish/shared/lib/aisles";
import { createClientId } from "@norish/shared/lib/operation-helpers";

/** An aisle as it is being typed: a client-minted id (ADR-0003) and a name. */
export interface EditingAisle {
  id: string;
  name: string;
}

interface StoreAislesEditorProps {
  aisles: EditingAisle[];
  onChange: (aisles: EditingAisle[]) => void;
  /** Whether the editor is on screen; the half-typed aisle is let go when it is not. */
  open: boolean;
}

/**
 * A Store's Aisles as the household walks them: a field to add one by name,
 * a name to rename in place, a handle to reorder and an X to remove. Nothing
 * here writes anything — the list is the Store's until its footer Save — so
 * removing an aisle needs no confirmation. A name the Store already has,
 * compared without regard to case, is refused where it is typed.
 */
export function StoreAislesEditor({ aisles, onChange, open }: StoreAislesEditorProps) {
  const t = useTranslations("groceries.storeManager");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) setDraft("");
  }, [open]);

  const draftFolded = foldAisleName(draft);
  const draftDuplicate =
    draftFolded !== "" && aisles.some((aisle) => foldAisleName(aisle.name) === draftFolded);
  // Two aisles renamed onto one name: said under the list, and Save waits.
  const listDuplicate = duplicateAisleName(aisles.map((aisle) => aisle.name)) !== null;

  const add = () => {
    if (draftFolded === "" || draftDuplicate) return;
    onChange([...aisles, { id: createClientId(), name: draft.trim() }]);
    setDraft("");
  };
  const rename = (id: string, name: string) =>
    onChange(aisles.map((aisle) => (aisle.id === id ? { ...aisle, name } : aisle)));
  const remove = (id: string) => onChange(aisles.filter((aisle) => aisle.id !== id));

  return (
    <div data-testid="store-aisles">
      <p className="text-muted mb-2 text-sm font-medium">{t("aisles")}</p>

      {aisles.length > 0 && (
        <Reorder.Group
          axis="y"
          className="mb-2 flex flex-col gap-2"
          values={aisles}
          onReorder={onChange}
        >
          {aisles.map((aisle) => (
            <AisleRow
              key={aisle.id}
              aisle={aisle}
              labels={{ drag: t("dragAisle"), remove: t("removeAisle") }}
              onRemove={() => remove(aisle.id)}
              onRename={(name) => rename(aisle.id, name)}
            />
          ))}
        </Reorder.Group>
      )}
      {listDuplicate && (
        <p className="text-danger mb-2 text-sm" data-testid="aisle-list-duplicate">
          {t("aisleDuplicate")}
        </p>
      )}

      <div className="flex items-start gap-2">
        <TextField
          aria-label={t("addAisle")}
          className="min-w-0 flex-1"
          isInvalid={draftDuplicate}
          value={draft}
          onChange={setDraft}
        >
          <Input
            className={FIELD_CLASS}
            data-testid="aisle-name"
            placeholder={t("aisleNamePlaceholder")}
            style={FIELD_STYLE}
            variant="secondary"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          {draftDuplicate && (
            <FieldError data-testid="aisle-duplicate">{t("aisleDuplicate")}</FieldError>
          )}
        </TextField>
        <Button
          isIconOnly
          aria-label={t("addAisle")}
          className="mt-1 shrink-0"
          data-testid="add-aisle"
          isDisabled={draftFolded === "" || draftDuplicate}
          size="sm"
          variant="tertiary"
          onPress={add}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-muted mt-2 text-xs">{t("aislesHint")}</p>
    </div>
  );
}

interface AisleRowProps {
  aisle: EditingAisle;
  labels: { drag: string; remove: string };
  onRename: (name: string) => void;
  onRemove: () => void;
}

function AisleRow({ aisle, labels, onRename, onRemove }: AisleRowProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      className="bg-surface flex items-center gap-2 rounded-lg"
      data-testid="aisle-row"
      drag="y"
      dragControls={controls}
      dragElastic={0}
      dragListener={false}
      dragMomentum={false}
      style={{ position: "relative" }}
      value={aisle}
    >
      <button
        aria-label={labels.drag}
        className="text-muted shrink-0 cursor-grab touch-none p-1 active:cursor-grabbing"
        type="button"
        onPointerDown={(e) => controls.start(e)}
      >
        <Bars3Icon className="h-4 w-4" />
      </button>
      <TextField
        aria-label={aisle.name}
        className="min-w-0 flex-1"
        value={aisle.name}
        onChange={onRename}
      >
        <Input
          className={FIELD_CLASS}
          data-testid="aisle-row-name"
          style={FIELD_STYLE}
          variant="secondary"
        />
      </TextField>
      <Button
        isIconOnly
        aria-label={labels.remove}
        className="shrink-0"
        data-testid="remove-aisle"
        size="sm"
        variant="tertiary"
        onPress={onRemove}
      >
        <XMarkIcon className="h-4 w-4" />
      </Button>
    </Reorder.Item>
  );
}
