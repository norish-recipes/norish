import type { ComponentRef } from "react";
import React, { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { useIntl } from "react-intl";

import { MIN_SERVINGS } from "@norish/shared-react/recipes";
import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";

/** The stepper's value in the Servings sheet; tap it to type any count of at least `MIN_SERVINGS`. */
export function TypedServings({
  servings,
  onChange,
}: {
  servings: number;
  onChange: (servings: number) => void;
}) {
  const intl = useIntl();
  const [draft, setDraft] = useState<string | null>(null);
  const fieldRef = useFocusOnMount<ComponentRef<typeof TextInput>>(draft !== null);

  if (draft === null) {
    return (
      <Pressable
        accessibilityRole="button"
        className="min-w-24 items-center py-2"
        testID="recipe-servings-sheet-value"
        onPress={() => setDraft(formatAmountAsDecimal(servings))}
      >
        <Text className="text-foreground text-base font-semibold">
          {intl.formatMessage({ id: "recipes.glanceBar.servings" }, { count: servings })}
        </Text>
      </Pressable>
    );
  }

  return (
    <TextInput
      ref={fieldRef}
      selectTextOnFocus
      accessibilityLabel={intl.formatMessage({ id: "recipes.form.servings" })}
      className="text-foreground min-w-24 py-2 text-center text-base font-semibold"
      inputMode="decimal"
      testID="recipe-servings-input"
      value={draft}
      onBlur={() => setDraft(null)}
      onChangeText={(text) => {
        const typed = Number(text.replace(",", "."));

        setDraft(text);
        if (typed >= MIN_SERVINGS) onChange(typed);
      }}
      onSubmitEditing={() => setDraft(null)}
    />
  );
}
