import type { ComponentRef } from "react";
import { useRef, useState } from "react";
import { TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useSpellingRules } from "@norish/shared-react/config";
import {
  useOnTheList,
  usePantryField,
  usePantryQuery,
  usePantrySuggestions,
  usePutOnTheList,
} from "@norish/shared-react/groceries";
import { useIngredientIcons, usePantryCatalogue } from "@norish/shared-react/ingredients";
import { usePlatform } from "@norish/shared-react/platform";
import { searchPantry, uncoveredSuggestions } from "@norish/shared/lib/pantry";

import type { PantryActions } from "../components/pantry-rows";
import { pantryRows } from "../utils/pantry-rows";

/** The Pantry screen's state: what the field has narrowed, what is folded, and what a row does. */
export function usePantryScreen() {
  const intl = useIntl();
  const router = useRouter();
  const rules = useSpellingRules();
  const { toast } = usePlatform();
  const { items, isRead, isUnavailable } = usePantryQuery();
  const { suggestions } = usePantrySuggestions();
  const onTheList = useOnTheList(items);
  const putOnList = usePutOnTheList(intl.locale);
  const { draft, setDraft, typed, canAdd, keep } = usePantryField(items, intl.locale, rules);
  const fieldRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [startedEmpty, setStartedEmpty] = useState<boolean | null>(null);
  const [folded, setFolded] = useState<boolean | null>(null);
  const [showAll, setShowAll] = useState(false);
  const matches = usePantryCatalogue(
    typed,
    intl.locale,
    new Set(items.map((item) => item.ingredientId))
  );
  const kept = searchPantry(items, draft, intl.locale, rules);
  const offered = uncoveredSuggestions(items, suggestions, rules);

  // "From your recipes" opens when the Pantry was empty as it was first read.
  if (startedEmpty === null && isRead) setStartedEmpty(items.length === 0);

  const suggestionsOpen = folded === null ? startedEmpty === true : !folded;
  const rows = pantryRows(
    { items, kept, onTheList, matches, offered },
    { typed, suggestionsOpen, showAll }
  );

  useIngredientIcons([
    ...kept.map((item) => item.ingredientId),
    ...matches.map((food) => food.id),
    ...(suggestionsOpen ? offered.map((food) => food.ingredientId) : []),
  ]);

  const add = keep;
  const actions: PantryActions = {
    open: (item) => router.push({ pathname: "/groceries/food", params: { id: item.id } }),
    putOnTheList: (item) => {
      const { name, undo } = putOnList(item);

      toast.show({
        severity: "success",
        title: intl.formatMessage({ id: "groceries.pantry.putOnTheListToast" }, { name }),
        actionLabel: intl.formatMessage({ id: "groceries.pantry.undo" }),
        onActionPress: undo,
      });
    },
    keep: add,
    fold: setFolded,
    showMore: () => setShowAll(true),
  };

  return {
    rows,
    actions,
    field: { ref: fieldRef, draft, setDraft, canAdd, add: () => canAdd && add(typed) },
    // Until a read holds data the Pantry is unread, not empty: the rows wait and the field is inert.
    unread: !isRead,
    isUnavailable,
  };
}
