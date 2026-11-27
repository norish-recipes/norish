"use client";

import { PanelComboBoxPopover } from "@/components/Panel/Panel";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { IngredientPick } from "@norish/shared-react/ingredients";
import { useIngredientPicker } from "@norish/shared-react/ingredients";

/** Searches Ingredients by any spelling, never `excludeId`; `editableOnly` keeps the viewer's editable ones. */
export function IngredientPicker({
  label,
  excludeId,
  editableOnly,
  onPick,
}: {
  label: string;
  excludeId: string;
  editableOnly: boolean;
  onPick: (pick: IngredientPick | null) => void;
}) {
  const t = useTranslations("settings.ingredients");
  const locale = useLocale();
  // Inside a Panel the options must portal into it, or vaul swallows every tap (#511).
  const { term, picked, options, hint, type, pick } = useIngredientPicker({
    excludeId,
    editableOnly,
    locale,
    onPick,
  });

  return (
    <ComboBox
      allowsEmptyCollection
      className="min-w-0 flex-1"
      inputValue={term}
      items={options}
      // The list opens once there is something to search by, never empty on focus.
      menuTrigger="input"
      value={picked}
      variant="secondary"
      onInputChange={type}
      onChange={(key) => {
        const option = options.find((candidate) => candidate.id === key);

        if (option) pick(option);
      }}
    >
      <Label className="sr-only">{label}</Label>
      {/* Search-only, so no trigger: ComboBox.InputGroup expects one as its last child and
          hands its slot props to whatever sits there, which the Input would pass to the DOM. */}
      <Input
        data-testid="ingredient-picker"
        placeholder={t("pickIngredient")}
        variant="secondary"
      />
      <PanelComboBoxPopover>
        <ListBox
          renderEmptyState={() => (
            <p className="text-muted px-3 py-2 text-sm">
              {hint === "hint"
                ? t("pickerHint")
                : hint === "searching"
                  ? t("pickerSearching")
                  : t("pickerEmpty")}
            </p>
          )}
        >
          {(option: { id: string; name: string }) => (
            <ListBox.Item
              data-testid="ingredient-picker-option"
              id={option.id}
              textValue={option.name}
            >
              {option.name}
            </ListBox.Item>
          )}
        </ListBox>
      </PanelComboBoxPopover>
    </ComboBox>
  );
}
