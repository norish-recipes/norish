import { useState } from "react";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import type { SpellingRules } from "@norish/shared/lib/spelling-keys";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";
import { foodKey } from "@norish/shared/lib/spelling-keys";

import type { PickedFood } from "./types";
import { usePantryMutations } from "./use-pantry-mutations";

/**
 * The Pantry's one field: its text, whether that text can be added (a food, not one already
 * kept), and `keep`, which adds a typed name or a picked food and empties the field.
 */
export function usePantryField(
  items: readonly PantryIngredientDto[],
  locale: string,
  rules: SpellingRules
) {
  const { addPantryIngredient } = usePantryMutations();
  const [draft, setDraft] = useState("");
  const named = foodKey(draft, rules) !== "";
  const canAdd = named && pantryIngredientFor(items, { ingredientName: draft }, rules) === null;

  const keep = (food: string | PickedFood) => {
    const name = typeof food === "string" ? food : ingredientDisplayName(food, locale);

    void addPantryIngredient(food, name);
    setDraft("");
  };

  return { draft, setDraft, typed: draft.trim(), canAdd, keep };
}
