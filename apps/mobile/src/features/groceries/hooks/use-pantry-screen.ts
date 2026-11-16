import { useState } from "react";
import { TAB_ROUTES } from "@/lib/tab-routes";
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
import { useIngredientIcons } from "@norish/shared-react/ingredients";
import { usePlatform } from "@norish/shared-react/platform";
import { searchPantry, uncoveredSuggestions } from "@norish/shared/lib/pantry";

import type { PantryActions } from "../components/pantry-rows";
import { pantryRows } from "../utils/pantry-rows";

/** The Pantry screen's state: what the field narrows (it only filters), what is folded, and what a row does. */
export function usePantryScreen() {
  const intl = useIntl();
  const router = useRouter();
  const rules = useSpellingRules();
  const { toast } = usePlatform();
  const { items, isRead, isUnavailable } = usePantryQuery();
  const { suggestions } = usePantrySuggestions();
  const onTheList = useOnTheList(items);
  const putOnList = usePutOnTheList(intl.locale);
  const { draft, setDraft, typed, keep } = usePantryField(items, intl.locale, rules);
  const [startedEmpty, setStartedEmpty] = useState<boolean | null>(null);
  const [folded, setFolded] = useState<boolean | null>(null);
  const [showAll, setShowAll] = useState(false);
  const kept = searchPantry(items, draft, intl.locale, rules);
  const offered = uncoveredSuggestions(items, suggestions, rules);

  // "From your recipes" opens when the Pantry was empty as it was first read.
  if (startedEmpty === null && isRead) setStartedEmpty(items.length === 0);

  const suggestionsOpen = folded === null ? startedEmpty === true : !folded;
  const rows = pantryRows({ items, kept, onTheList, offered }, { typed, suggestionsOpen, showAll });

  useIngredientIcons([
    ...kept.map((item) => item.ingredientId),
    ...(suggestionsOpen ? offered.map((food) => food.ingredientId) : []),
  ]);

  const actions: PantryActions = {
    open: (item) => router.push({ pathname: TAB_ROUTES.groceries.food, params: { id: item.id } }),
    putOnTheList: (item) => {
      const { name, undo } = putOnList(item);

      toast.show({
        severity: "success",
        title: intl.formatMessage({ id: "groceries.pantry.putOnTheListToast" }, { name }),
        actionLabel: intl.formatMessage({ id: "groceries.pantry.undo" }),
        onActionPress: undo,
      });
    },
    keep,
    fold: setFolded,
    showMore: () => setShowAll(true),
  };

  return {
    rows,
    actions,
    field: { draft, setDraft },
    // Until a read holds data the Pantry is unknown, not empty: the rows wait and the field is inert.
    isRead,
    isUnavailable,
  };
}
