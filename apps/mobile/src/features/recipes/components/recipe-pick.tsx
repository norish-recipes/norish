import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { CardPhoto } from "@/components/card-photo";
import { SearchField } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";

import { PickRow } from "./pick-row";
import { PickSheet } from "./pick-sheet";

/** The search field over a recipe picker; `onChange` is absent while what it searches loads. */
function SearchRecipes({
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

/** What a recipe picker reads from `useRecipePick`, over the recipes it offers. */
type RecipePick = {
  input: string;
  setInput: (value: string) => void;
  recipes: RecipeDashboardDTO[];
  isLoading: boolean;
  loadMore: () => void;
  selected: string[];
  toggle: (recipeId: string) => void;
};

/**
 * A sheet to tick recipes in: `children` over the search, then a ticked row per recipe or the
 * reason there is none. Without a `pick` the search is off and the rows are skeletons.
 */
export function RecipePickSheet({
  pick,
  emptyId,
  children,
  ...sheet
}: {
  pick?: RecipePick;
  /** The message shown when `pick` offers no recipe. */
  emptyId: string;
  /** Above the search, such as a name field. */
  children?: ReactNode;
} & Pick<ComponentProps<typeof PickSheet>, "name" | "title" | "subtitle" | "action">) {
  const intl = useIntl();

  return (
    <PickSheet
      {...sheet}
      header={
        <View className="gap-2">
          {children}
          <SearchRecipes value={pick?.input} onChange={pick?.setInput} />
        </View>
      }
      list={
        pick && !pick.isLoading
          ? {
              items: pick.recipes,
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
                  selected={pick.selected.includes(recipe.id)}
                  testID={`cookbook-add-recipes-row-${recipe.id}`}
                  title={recipe.name}
                  onToggle={() => pick.toggle(recipe.id)}
                />
              ),
              onEndReached: pick.loadMore,
            }
          : undefined
      }
    />
  );
}
