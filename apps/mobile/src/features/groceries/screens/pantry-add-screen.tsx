import type { SheetSearchInput } from "@/components/sheet-search-field";
import React from "react";
import { Text, View } from "react-native";
import { IngredientIconSlots } from "@/components/ingredient-icon";
import { Sheet, SheetList } from "@/components/sheet";
import { SheetSearchField } from "@/components/sheet-search-field";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { successNotification } from "@/lib/haptics";
import { useIntl } from "react-intl";

import { useSpellingRules } from "@norish/shared-react/config";
import { usePantryField, usePantryQuery } from "@norish/shared-react/groceries";
import { useIngredientIcons, usePantryCatalogue } from "@norish/shared-react/ingredients";

import { PantryAddRowView } from "../components/pantry-add-row";
import { pantryAddRows } from "../utils/pantry-add-rows";

/** Add to pantry: search the Ingredients, keep one, or keep the text as typed; the sheet stays open for the next. */
export function PantryAddScreen() {
  const intl = useIntl();
  const rules = useSpellingRules();
  const { items, isRead } = usePantryQuery();
  const { draft, setDraft, typed, canAdd, keep } = usePantryField(items, intl.locale, rules);
  const matches = usePantryCatalogue(
    typed,
    intl.locale,
    new Set(items.map((item) => item.ingredientId))
  );
  const fieldRef = useFocusOnMount<SheetSearchInput>();
  const rows = pantryAddRows(typed, matches, canAdd);
  const label = intl.formatMessage({ id: "groceries.pantry.fieldPlaceholder" });

  useIngredientIcons(matches.map((food) => food.id));

  const keepFood: typeof keep = (food) => {
    keep(food);
    successNotification();
  };

  return (
    <Sheet name="pantry-add" title={intl.formatMessage({ id: "groceries.pantry.add" })}>
      <IngredientIconSlots rows={rows}>
        <SheetList
          ListEmptyComponent={
            <View>
              {typed === "" ? null : (
                <Text className="text-muted px-5 py-6 text-center" testID="pantry-add-none">
                  {intl.formatMessage({ id: "common.status.noResults" })}
                </Text>
              )}
            </View>
          }
          ListHeaderComponent={
            <View className="px-5 pb-3">
              <SheetSearchField
                fieldRef={fieldRef}
                label={label}
                testID="pantry-add-field"
                value={draft}
                // Taking nothing until the Pantry is read: a food added then could double one kept.
                onChange={isRead ? setDraft : undefined}
                onSubmit={() => canAdd && keepFood(typed)}
              />
            </View>
          }
          data={rows}
          inset={false}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) => <PantryAddRowView row={item} onKeep={keepFood} />}
          testID="pantry-add-list"
        />
      </IngredientIconSlots>
    </Sheet>
  );
}
