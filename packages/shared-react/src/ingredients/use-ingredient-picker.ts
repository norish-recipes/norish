"use client";

import { useEffect, useState } from "react";

import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import { useIngredientSearchQuery } from "./use-ingredient-query";

/** How long typing pauses before the catalogue is searched. */
const SEARCH_DELAY_MS = 250;

/** One food as the picker lists it. */
export interface PickerOption {
  id: string;
  name: string;
}

/**
 * Searches foods by any spelling, never `excludeId`; `editableOnly` keeps the viewer's editable
 * ones. `hint` says why the list is empty: nothing typed, still searching, or nothing found.
 */
export function useIngredientPicker({
  excludeId,
  editableOnly,
  locale,
  onPick,
}: {
  excludeId: string;
  editableOnly: boolean;
  locale: string;
  onPick: (pick: PickerOption | null) => void;
}) {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const typed = term.trim();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [typed]);

  const { items, isFetching } = useIngredientSearchQuery(search || null, locale);
  const options: PickerOption[] = items
    .filter((item) => item.id !== excludeId && (!editableOnly || item.canEdit))
    .map((item) => ({ id: item.id, name: ingredientDisplayName(item, locale) }));
  const hint = typed === "" ? "hint" : isFetching || search !== typed ? "searching" : "empty";

  return {
    term,
    picked,
    options,
    hint: options.length === 0 ? hint : null,
    type: (value: string) => {
      setTerm(value);
      if (picked !== null) {
        setPicked(null);
        onPick(null);
      }
    },
    pick: (option: PickerOption) => {
      setPicked(option.id);
      setTerm(option.name);
      onPick(option);
    },
  };
}
