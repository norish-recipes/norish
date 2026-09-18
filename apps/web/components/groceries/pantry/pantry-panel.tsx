"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import { IngredientNamePicture } from "@/components/ingredients/ingredient-name-picture";
import {
  NameSuggestionList,
  nameSuggestionOptionId,
} from "@/components/ingredients/name-suggestion-list";
import Panel from "@/components/Panel/Panel";
import { IconActionButton } from "@/components/shared/action-button";
import { useIngredientNamesQuery } from "@/hooks/config";
import { usePantryMutations, usePantryQuery } from "@/hooks/pantry";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Button, FieldError, Input, TextField } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import { PANTRY_INGREDIENT_NAME_MAX_LENGTH } from "@norish/shared/contracts/zod";
import { suggestIngredientNames } from "@norish/shared/lib/ingredient-pictures";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";
import { pantryIngredientFor, sortPantryIngredients } from "@norish/shared/lib/pantry";

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
  const { ingredients: known } = useIngredientNamesQuery({ enabled: open });
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const [highlighted, setHighlighted] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const listId = useId();

  useEffect(() => {
    if (!open) setDraft("");
  }, [open]);

  const draftFolded = normalizeGroceryName(draft);
  const draftDuplicate = draftFolded !== "" && pantryIngredientFor(items, draft) !== null;
  const sorted = sortPantryIngredients(items, locale);

  // The names Norish already knows, offered as the cupboard is typed, exactly
  // as a recipe's ingredient line offers them (ADR-0037). A name the Pantry
  // already holds is left out: adding it again is refused anyway.
  const suggestions = useMemo(
    () =>
      dismissed
        ? []
        : suggestIngredientNames(draft, known).filter(
            (suggestion) => pantryIngredientFor(items, suggestion.name) === null
          ),
    [dismissed, draft, known, items]
  );

  const setTyped = (value: string) => {
    setDraft(value);
    setHighlighted(-1);
    setDismissed(false);
  };

  const pick = (index: number) => {
    const picked = suggestions[index];

    if (!picked) return;

    setDraft(picked.name);
    setHighlighted(-1);
    setDismissed(true);
  };

  const add = () => {
    if (draftFolded === "" || draftDuplicate) return;
    void addPantryIngredient(draft.trim()).catch(() => undefined);
    setDraft("");
    setHighlighted(-1);
    setDismissed(false);
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
                <IngredientNamePicture name={item.name} />
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
          <div className="relative min-w-0 flex-1">
            <TextField
              aria-label={t("add")}
              className="min-w-0 flex-1"
              isInvalid={draftDuplicate}
              value={draft}
              onChange={setTyped}
            >
              <Input
                ref={field}
                aria-activedescendant={
                  highlighted >= 0 ? nameSuggestionOptionId(listId, highlighted) : undefined
                }
                aria-autocomplete="list"
                aria-controls={suggestions.length > 0 ? listId : undefined}
                aria-expanded={suggestions.length > 0}
                className={FIELD_CLASS}
                data-testid="pantry-name"
                maxLength={PANTRY_INGREDIENT_NAME_MAX_LENGTH}
                placeholder={t("namePlaceholder")}
                role="combobox"
                style={FIELD_STYLE}
                variant="secondary"
                onKeyDown={(e) => {
                  if (suggestions.length > 0 && e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlighted((current) => Math.min(suggestions.length - 1, current + 1));

                    return;
                  }

                  if (suggestions.length > 0 && e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlighted((current) => Math.max(-1, current - 1));

                    return;
                  }

                  if (e.key === "Escape" && suggestions.length > 0) {
                    e.preventDefault();
                    setDismissed(true);
                    setHighlighted(-1);

                    return;
                  }

                  // A highlighted name is taken; otherwise Enter is what it has
                  // always been, the gesture that adds what was typed.
                  if ((e.key === "Enter" || e.key === "Tab") && highlighted >= 0) {
                    e.preventDefault();
                    pick(highlighted);

                    return;
                  }

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
            <NameSuggestionList
              openAbove
              highlighted={highlighted}
              id={listId}
              label={t("suggestions")}
              suggestions={suggestions.map((suggestion) => ({
                key: suggestion.key,
                label: suggestion.name,
                imageUrl: suggestion.imageUrl,
              }))}
              onHighlight={setHighlighted}
              onPick={pick}
            />
          </div>
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
