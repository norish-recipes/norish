import type { SheetSearchInput } from "@/components/sheet-search-field";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { IngredientIconSlots } from "@/components/ingredient-icon";
import { Sheet, SheetList } from "@/components/sheet";
import { SheetSearchField } from "@/components/sheet-search-field";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { useIntl } from "react-intl";

import { useSpellingRules } from "@norish/shared-react/config";
import { usePantryQuery, usePantrySuggestions } from "@norish/shared-react/groceries";
import {
  foodNamedAsTyped,
  useIngredientIcons,
  usePantryCatalogue,
} from "@norish/shared-react/ingredients";
import { PANTRY_INGREDIENT_NAME_MAX_LENGTH } from "@norish/shared/contracts/zod";

import { PantryAddRowView } from "../components/pantry-add-row";
import { ShowMore } from "../components/pantry-rows";
import { useKeepingField } from "../hooks/use-keeping-field";
import { pantryAddList, pickedFood } from "../utils/pantry-add-rows";

/** Add to pantry: search the Ingredients, keep one, or keep the text as typed; the sheet stays open for the next. */
export function PantryAddScreen() {
  const intl = useIntl();
  const rules = useSpellingRules();
  const { items, isRead } = usePantryQuery();
  const { draft, setDraft, typed, canAdd, keep } = useKeepingField(items, intl.locale, rules);
  const matches = usePantryCatalogue(
    typed,
    intl.locale,
    new Set(items.map((item) => item.ingredientId))
  );
  const fieldRef = useFocusOnMount<SheetSearchInput>();
  const named = foodNamedAsTyped(typed, matches, rules);
  // The text as typed, offered while it is not kept already and no found food is named so.
  const custom = canAdd && !named ? typed : null;
  const { suggestions: offered } = usePantrySuggestions(items);
  const [showAll, setShowAll] = useState(false);
  const { rows, fromYourRecipes, more } = pantryAddList(
    { typed, isRead, offered, showAll, matches, custom },
    intl.locale
  );
  const label = intl.formatMessage({ id: "groceries.pantry.fieldPlaceholder" });

  useIngredientIcons(rows.flatMap((row) => (row.foodId ? [row.foodId] : [])));

  const submit = () => {
    const food = named ? pickedFood(named) : custom;

    if (food) keep(food);
  };

  return (
    <Sheet name="pantry-add" title={intl.formatMessage({ id: "groceries.pantry.add" })}>
      <IngredientIconSlots rows={rows}>
        <SheetList
          ListEmptyComponent={
            typed === "" ? undefined : (
              <Text className="text-muted px-5 py-6 text-center" testID="pantry-add-none">
                {intl.formatMessage({ id: "common.status.noResults" })}
              </Text>
            )
          }
          ListFooterComponent={more ? <ShowMore onPress={() => setShowAll(true)} /> : undefined}
          ListHeaderComponent={
            <View className="px-5 pb-3">
              <SheetSearchField
                fieldRef={fieldRef}
                label={label}
                maxLength={PANTRY_INGREDIENT_NAME_MAX_LENGTH}
                testID="pantry-add-field"
                value={draft}
                // Taking nothing until the Pantry is read: a food added then could double one kept.
                onChange={isRead ? setDraft : undefined}
                onSubmit={submit}
              />
              {fromYourRecipes ? (
                <Text className="text-muted px-2 pt-3 text-xs font-semibold uppercase">
                  {intl.formatMessage({ id: "groceries.pantry.fromYourRecipes" })}
                </Text>
              ) : null}
            </View>
          }
          data={rows}
          inset={false}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) => <PantryAddRowView row={item} onKeep={keep} />}
          testID="pantry-add-list"
        />
      </IngredientIconSlots>
    </Sheet>
  );
}
