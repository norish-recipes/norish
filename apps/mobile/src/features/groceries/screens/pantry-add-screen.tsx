import type { SheetSearchInput } from "@/components/sheet-search-field";
import React, { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { EmptyCard } from "@/components/empty-card";
import { IngredientIconSlots } from "@/components/ingredient-icon";
import { SectionLabel } from "@/components/section-label";
import { Sheet, SheetList } from "@/components/sheet";
import { SheetSearchField } from "@/components/sheet-search-field";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { SPRING_FADE_IN, SPRING_FADE_OUT } from "@/lib/motion/layout";
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
import { FoodRowsSkeleton, ShowMore } from "../components/pantry-rows";
import { useKeepingField } from "../hooks/use-keeping-field";
import { pantryAddList, pickedFood } from "../utils/pantry-add-rows";

/** Add to pantry: search the Ingredients, keep one, or keep the text as typed; the sheet stays open for the next. */
export function PantryAddScreen() {
  const intl = useIntl();
  const rules = useSpellingRules();
  const { items, isRead } = usePantryQuery();
  const { draft, setDraft, typed, canAdd, keep } = useKeepingField(items, intl.locale, rules);
  const { matches, searching } = usePantryCatalogue(
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
  // The text as typed waits with the matches, so the card does not jump when they arrive.
  const { rows, fromYourRecipes, more } = pantryAddList(
    { typed, isRead, offered, showAll, matches, custom: searching ? null : custom },
    intl.locale
  );
  const label = intl.formatMessage({ id: "groceries.pantry.fieldPlaceholder" });
  // Any typing folds Show more back, so a cleared field offers the first six again.
  const change = (text: string) => {
    setDraft(text);
    setShowAll(false);
  };

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
            searching ? (
              // Fades out over the matches fading in, one crossfade.
              <Animated.View exiting={SPRING_FADE_OUT}>
                <FoodRowsSkeleton rows={3} testID="pantry-add-searching" />
              </Animated.View>
            ) : typed === "" ? undefined : (
              <EmptyCard
                icon="search-outline"
                testID="pantry-add-none"
                title={intl.formatMessage({ id: "common.status.noResults" })}
              />
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
                onChange={isRead ? change : undefined}
                onSubmit={submit}
              />
              {fromYourRecipes ? (
                <SectionLabel className="pt-3">
                  {intl.formatMessage({ id: "groceries.pantry.fromYourRecipes" })}
                </SectionLabel>
              ) : null}
            </View>
          }
          data={rows}
          inset={false}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) => (
            <Animated.View entering={typed === "" ? undefined : SPRING_FADE_IN}>
              <PantryAddRowView row={item} onKeep={keep} />
            </Animated.View>
          )}
          testID="pantry-add-list"
        />
      </IngredientIconSlots>
    </Sheet>
  );
}
