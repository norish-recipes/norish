import React, { use } from "react";
import { Pressable, Text, View } from "react-native";
import { useIntl } from "react-intl";

import type { IngredientSuggestion } from "@norish/shared-react/recipes";

import { FocusedFieldContext } from "../../hooks/use-focused-field-in-view";
import { IngredientIcon } from "../ingredient-icon";

/** The lines an `@` query matches, under the step's field; a tap links one to the step. */
export function MentionPopup({
  matches,
  foods,
  onPick,
}: {
  matches: IngredientSuggestion[];
  foods: ReadonlyMap<string, string | null>;
  onPick: (suggestion: IngredientSuggestion) => void;
}) {
  const intl = useIntl();
  const reportFocus = use(FocusedFieldContext);

  return (
    <View
      accessibilityLabel={intl.formatMessage({ id: "recipes.stepInput.ingredientSuggestions" })}
      className="bg-surface border-border overflow-hidden rounded-2xl border shadow-lg"
      testID="editor-mention-popup"
      // The popup opens under the field, so it brings itself clear of the keyboard and pill.
      onLayout={(event) => {
        if (typeof event.currentTarget !== "number") reportFocus?.(event.currentTarget);
      }}
    >
      {matches.map((suggestion, position) => (
        <Pressable
          key={suggestion.key}
          accessibilityRole="button"
          className={`min-h-11 flex-row items-center gap-2.5 px-3.5 ${position === 0 ? "" : "border-separator border-t"}`}
          testID={`editor-mention-${suggestion.ingredientOrder}`}
          onPress={() => onPick(suggestion)}
        >
          <IngredientIcon ingredientId={foods.get(suggestion.label) ?? null} size={22} />
          <Text className="text-foreground text-base">{suggestion.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
