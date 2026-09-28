"use client";

import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

/** How long typing pauses before the catalogue is searched. */
const SEARCH_DELAY_MS = 250;

/** The option that stands for a new Ingredient rather than a known one. */
const NEW_INGREDIENT = "__new__";

/** What a person picked: a known Ingredient, or a new one (`id` null). */
export type IngredientPick = { id: string; name: string } | { id: null };

/**
 * Find an Ingredient to merge into or move a spelling to, by any of its
 * spellings. Only Ingredients the viewer may edit are offered where
 * `editableOnly` says so (a merge needs `edit` on both), and never the one
 * the action starts from.
 */
export function IngredientPicker({
  label,
  excludeId,
  editableOnly,
  allowNew,
  onPick,
}: {
  label: string;
  excludeId: string;
  editableOnly: boolean;
  allowNew: boolean;
  onPick: (pick: IngredientPick | null) => void;
}) {
  const t = useTranslations("settings.ingredients");
  const locale = useLocale();
  const trpc = useTRPC();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [term]);

  const { data } = useQuery({
    ...trpc.ingredients.list.queryOptions({ search }),
    enabled: search.length > 0,
  });
  const found = (data?.items ?? []).filter(
    (item) => item.id !== excludeId && (!editableOnly || item.canEdit)
  );
  const options = [
    ...found.map((item) => ({ id: item.id, name: ingredientDisplayName(item, locale) })),
    ...(allowNew ? [{ id: NEW_INGREDIENT, name: t("newIngredient") }] : []),
  ];

  return (
    <ComboBox
      allowsEmptyCollection
      className="min-w-0 flex-1"
      inputValue={term}
      items={options}
      menuTrigger="focus"
      selectedKey={picked}
      variant="secondary"
      onInputChange={(value) => {
        setTerm(value);
        if (picked !== null) {
          setPicked(null);
          onPick(null);
        }
      }}
      onSelectionChange={(key) => {
        const option = options.find((candidate) => candidate.id === key);

        if (!option) return;
        setPicked(option.id);
        setTerm(option.name);
        onPick(option.id === NEW_INGREDIENT ? { id: null } : option);
      }}
    >
      <Label className="sr-only">{label}</Label>
      <ComboBox.InputGroup>
        <Input data-testid="ingredient-picker" placeholder={t("pickIngredient")} />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox renderEmptyState={() => null}>
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
      </ComboBox.Popover>
    </ComboBox>
  );
}
