import type { IntlShape } from "react-intl";
import React from "react";
import { Text } from "react-native";
import { CardPhoto } from "@/components/card-photo";
import { SearchField } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";

import type { PickList } from "./pick-sheet";
import { PickRow } from "./pick-row";

/** The search field over a recipe picker; `onChange` is absent while what it searches loads. */
export function SearchRecipes({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: "recipes.cookbooks.searchRecipes" });

  return (
    <SearchField isDisabled={!onChange} value={value} onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          accessibilityLabel={label}
          autoCorrect={false}
          className="bg-default h-12 rounded-3xl"
          placeholder={label}
          returnKeyType="search"
          testID="cookbook-add-recipes-search"
        />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}

/** The list of a recipe picker: a ticked row per recipe, or the reason there is none. */
export function recipePickList({
  intl,
  recipes,
  emptyId,
  selected,
  onToggle,
  onEndReached,
}: {
  intl: IntlShape;
  recipes: RecipeDashboardDTO[];
  emptyId: string;
  selected: string[];
  onToggle: (recipeId: string) => void;
  onEndReached: () => void;
}): PickList<RecipeDashboardDTO> {
  return {
    items: recipes,
    empty: (
      <Text className="text-muted py-10 text-center text-base">
        {intl.formatMessage({ id: emptyId })}
      </Text>
    ),
    keyExtractor: (recipe) => recipe.id,
    renderRow: (recipe, position) => (
      <PickRow
        media={<CardPhoto className="size-11 rounded-xl" image={recipe.image} onSheet />}
        position={position}
        selected={selected.includes(recipe.id)}
        testID={`cookbook-add-recipes-row-${recipe.id}`}
        title={recipe.name}
        onToggle={() => onToggle(recipe.id)}
      />
    ),
    onEndReached,
  };
}
