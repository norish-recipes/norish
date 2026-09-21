"use client";

import { useEffect, useRef, useState } from "react";
import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import Panel from "@/components/Panel/Panel";
import { IconActionButton } from "@/components/shared/action-button";
import { usePantryMutations, usePantryQuery } from "@/hooks/pantry";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Button, FieldError, Input, TextField } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";
import { pantryIngredientFor, sortPantryIngredients } from "@norish/shared/lib/pantry";

/** Pantry Ingredient names are one to a hundred characters; the field stops at the hundredth. */
export const PANTRY_NAME_MAX = 100;

interface PantryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The household's Pantry: what it already has at home, by name, with a field
 * to add one and an X to take one out. Each add and remove is written at
 * once, as a Store reorder is, and the field stays put so a cupboard can be
 * typed in one sitting. A name the Pantry already holds, compared by its
 * folded form, is refused where it is typed.
 */
export function PantryPanel({ open, onOpenChange }: PantryPanelProps) {
  const t = useTranslations("groceries.pantry");
  const locale = useLocale();
  const { items } = usePantryQuery();
  const { addPantryIngredient, removePantryIngredient } = usePantryMutations();
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setDraft("");
  }, [open]);

  const draftFolded = normalizeGroceryName(draft);
  const draftDuplicate = draftFolded !== "" && pantryIngredientFor(items, draft) !== null;
  const sorted = sortPantryIngredients(items, locale);

  const add = () => {
    if (draftFolded === "" || draftDuplicate) return;
    void addPantryIngredient(draft.trim()).catch(() => undefined);
    setDraft("");
    // The field is where the next name goes, whether the last one was added
    // from the keyboard or by pressing the plus.
    field.current?.focus();
  };

  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      <Panel.Body>
        <p className="text-muted mb-3 text-sm">{t("hint")}</p>

        {sorted.length === 0 ? (
          <p className="text-muted py-6 text-center" data-testid="pantry-empty">
            {t("empty")}
          </p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2" data-testid="pantry-ingredients">
            {sorted.map((item) => (
              <li
                key={item.id}
                className="bg-surface flex items-center gap-3 rounded-lg px-3 py-2"
                data-pantry-ingredient={item.normalizedName}
              >
                <span className="flex-1 truncate font-medium">{item.name}</span>
                <IconActionButton
                  action="remove"
                  label={t("remove")}
                  size="sm"
                  onPress={() => removePantryIngredient(item.id)}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-start gap-2">
          <TextField
            aria-label={t("add")}
            className="min-w-0 flex-1"
            isInvalid={draftDuplicate}
            value={draft}
            onChange={setDraft}
          >
            <Input
              ref={field}
              className={FIELD_CLASS}
              data-testid="pantry-name"
              maxLength={PANTRY_NAME_MAX}
              placeholder={t("namePlaceholder")}
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
              <FieldError data-testid="pantry-duplicate">{t("duplicate")}</FieldError>
            )}
          </TextField>
          <Button
            isIconOnly
            aria-label={t("add")}
            className="mt-1 shrink-0"
            data-testid="add-pantry-ingredient"
            isDisabled={draftFolded === "" || draftDuplicate}
            size="sm"
            variant="tertiary"
            onPress={add}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      </Panel.Body>
    </Panel>
  );
}
