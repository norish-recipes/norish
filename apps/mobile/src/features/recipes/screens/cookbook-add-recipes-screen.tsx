import React from "react";
import { Text } from "react-native";
import { CardPhoto } from "@/components/card-photo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SearchField } from "heroui-native";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useCookbookAddRecipes, useCookbookQuery } from "@norish/shared-react/recipes";

import { PickRow } from "../components/pick-row";
import { PickSheet } from "../components/pick-sheet";

function SearchRecipes({
  value,
  onChange,
}: {
  value?: string;
  /** Absent while the cookbook loads: the field is off and nothing is typed. */
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

function AddRecipesSheet({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const intl = useIntl();
  const router = useRouter();
  const { input, setInput, addable, hasRecipes, isLoading, loadMore, selected, toggle, save } =
    useCookbookAddRecipes(cookbook);

  return (
    <PickSheet
      action={{
        label:
          selected.length > 0
            ? intl.formatMessage({ id: "recipes.cookbooks.addCount" }, { count: selected.length })
            : intl.formatMessage({ id: "common.actions.add" }),
        icon: "add",
        testID: "cookbook-add-recipes-add",
        onPress:
          selected.length === 0
            ? undefined
            : () => {
                save();
                router.back();
              },
      }}
      header={<SearchRecipes value={input} onChange={setInput} />}
      list={
        isLoading
          ? undefined
          : {
              items: addable,
              empty: (
                <Text className="text-muted py-10 text-center text-base">
                  {intl.formatMessage({
                    id: hasRecipes
                      ? "recipes.cookbooks.everythingAlreadyIn"
                      : "recipes.cookbooks.noRecipesToAdd",
                  })}
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
                  onToggle={() => toggle(recipe.id)}
                />
              ),
              onEndReached: loadMore,
            }
      }
      name="cookbook-add-recipes"
      subtitle={cookbook.title}
      title={intl.formatMessage({ id: "recipes.cookbooks.addRecipes" })}
    />
  );
}

/** Add recipes: search what the cookbook does not hold, tick any number, then Add. */
export function CookbookAddRecipesScreen() {
  const intl = useIntl();
  const { cookbookId, title } = useLocalSearchParams<{ cookbookId: string; title?: string }>();
  const { cookbook } = useCookbookQuery(cookbookId ?? "");

  return cookbook ? (
    <AddRecipesSheet key={cookbook.id} cookbook={cookbook} />
  ) : (
    <PickSheet
      action={{
        label: intl.formatMessage({ id: "common.actions.add" }),
        icon: "add",
        testID: "cookbook-add-recipes-add",
      }}
      header={<SearchRecipes />}
      name="cookbook-add-recipes"
      subtitle={title}
      title={intl.formatMessage({ id: "recipes.cookbooks.addRecipes" })}
    />
  );
}
