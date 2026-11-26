import React, { useState } from "react";
import { View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { Section } from "@/components/section";
import { Sheet, SheetBody } from "@/components/sheet";
import { Switch } from "@/components/switch";
import { ToggleChip } from "@/components/toggle-chip";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";

import type { IngredientFilters } from "@norish/shared-react/ingredients";
import {
  DEFAULT_INGREDIENT_FILTERS,
  useIngredientFiltersStore,
} from "@norish/shared-react/ingredients";
import {
  INGREDIENT_SEARCH_FIELDS,
  INGREDIENT_SEARCH_MATCHES,
  toggleIngredientSearchField,
} from "@norish/shared/lib/ingredient-search";

/** The Ingredients list's filters: they land with Apply; Reset applies the defaults. */
export function IngredientFiltersScreen() {
  const text = useText();
  const router = useRouter();
  const applied = useIngredientFiltersStore((state) => state.filters);
  const apply = useIngredientFiltersStore((state) => state.apply);
  const [working, setWorking] = useState<IngredientFilters>(applied);
  const land = (filters: IngredientFilters) => {
    apply(filters);
    router.back();
  };
  const toggle = (
    key: "tree" | "flaggedOnly" | "standaloneOnly",
    label: string,
    first: boolean
  ) => (
    <CardRow first={first} label={label}>
      <Switch
        accessibilityLabel={label}
        isSelected={working[key]}
        testID={`ingredients-${key}`}
        onSelectedChange={(on) => setWorking({ ...working, [key]: on })}
      />
    </CardRow>
  );

  return (
    <Sheet
      confirm={{ label: text("common.actions.apply"), onPress: () => land(working) }}
      name="ingredient-filters"
      secondary={[
        {
          label: text("common.actions.reset"),
          symbol: "arrow.counterclockwise",
          onPress: () => land(DEFAULT_INGREDIENT_FILTERS),
        },
      ]}
      title={text("common.filters.title")}
    >
      <SheetBody>
        <Section title={text("settings.ingredients.searchMatch")}>
          <View className="flex-row flex-wrap gap-2">
            {INGREDIENT_SEARCH_MATCHES.map((match) => (
              <ToggleChip
                key={match}
                active={working.match === match}
                label={text(`settings.ingredients.searchMatches.${match}`)}
                testID={`ingredients-match-${match}`}
                onPress={() => setWorking({ ...working, match })}
              />
            ))}
          </View>
        </Section>
        <Section title={text("settings.ingredients.searchIn")}>
          <View className="flex-row flex-wrap gap-2">
            {INGREDIENT_SEARCH_FIELDS.map((field) => (
              <ToggleChip
                key={field}
                active={working.fields.includes(field)}
                label={text(`settings.ingredients.searchFields.${field}`)}
                testID={`ingredients-field-${field}`}
                onPress={() =>
                  setWorking({
                    ...working,
                    fields: toggleIngredientSearchField(working.fields, field),
                  })
                }
              />
            ))}
          </View>
        </Section>
        <Section title={text("settings.ingredients.layoutSection")}>
          <Card>{toggle("tree", text("settings.ingredients.asTree"), true)}</Card>
        </Section>
        <Section title={text("settings.ingredients.showOnly")}>
          <Card>
            {toggle("flaggedOnly", text("settings.ingredients.flaggedOnly"), true)}
            {toggle("standaloneOnly", text("settings.ingredients.standaloneOnly"), false)}
          </Card>
        </Section>
      </SheetBody>
    </Sheet>
  );
}
