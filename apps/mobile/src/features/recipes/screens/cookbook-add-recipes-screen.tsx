import React from "react";
import { Text, View } from "react-native";
import { CardPhoto } from "@/components/card-photo";
import { Sheet, SheetList, SheetScrollView } from "@/components/sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, SearchField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useCookbookAddRecipes, useCookbookQuery } from "@norish/shared-react/recipes";

import { PickRow, PickRowSkeleton } from "../components/pick-row";

const SKELETON_ROWS = [0, 1, 2, 3, 4];

/** The Add button: the count of recipes ticked, pressable once there is one. */
function AddButton({ count, onPress }: { count: number; onPress?: () => void }) {
  const intl = useIntl();
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);

  return (
    <Button
      className="h-[50px] rounded-full"
      isDisabled={!onPress}
      testID="cookbook-add-recipes-add"
      variant="primary"
      onPress={onPress}
    >
      <Ionicons color={accentForeground} name="add" size={20} />
      <Button.Label className="text-base font-semibold">
        {count > 0
          ? intl.formatMessage({ id: "recipes.cookbooks.addCount" }, { count })
          : intl.formatMessage({ id: "common.actions.add" })}
      </Button.Label>
    </Button>
  );
}

function SearchRecipes({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: "recipes.cookbooks.searchRecipes" });

  return (
    <SearchField value={value} onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          accessibilityLabel={label}
          autoCorrect={false}
          className="bg-surface h-12 rounded-3xl"
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
    <Sheet
      actions={
        <AddButton
          count={selected.length}
          onPress={
            selected.length === 0
              ? undefined
              : () => {
                  save();
                  router.back();
                }
          }
        />
      }
      name="cookbook-add-recipes"
      subtitle={cookbook.title}
      title={intl.formatMessage({ id: "recipes.cookbooks.addRecipes" })}
    >
      <SheetList
        ListEmptyComponent={
          isLoading ? (
            <View testID="cookbook-add-recipes-skeleton">
              {SKELETON_ROWS.map((row) => (
                <PickRowSkeleton
                  key={row}
                  position={{ first: row === 0, last: row === SKELETON_ROWS.length - 1 }}
                />
              ))}
            </View>
          ) : (
            <Text className="text-muted py-10 text-center text-base">
              {intl.formatMessage({
                id: hasRecipes
                  ? "recipes.cookbooks.everythingAlreadyIn"
                  : "recipes.cookbooks.noRecipesToAdd",
              })}
            </Text>
          )
        }
        ListHeaderComponent={
          <View className="pb-3">
            <SearchRecipes value={input} onChange={setInput} />
          </View>
        }
        data={isLoading ? [] : addable}
        keyExtractor={(recipe) => recipe.id}
        renderItem={({ item: recipe, index }) => (
          <PickRow
            media={<CardPhoto className="size-11 rounded-xl" image={recipe.image} />}
            position={{ first: index === 0, last: index === addable.length - 1 }}
            selected={selected.includes(recipe.id)}
            testID={`cookbook-add-recipes-row-${recipe.id}`}
            title={recipe.name}
            onToggle={() => toggle(recipe.id)}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
      />
    </Sheet>
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
    <Sheet
      actions={<AddButton count={0} />}
      name="cookbook-add-recipes"
      subtitle={title}
      title={intl.formatMessage({ id: "recipes.cookbooks.addRecipes" })}
    >
      <SheetScrollView>
        <View className="pb-3">
          <SearchRecipes value="" onChange={() => {}} />
        </View>
        {SKELETON_ROWS.map((row) => (
          <PickRowSkeleton
            key={row}
            position={{ first: row === 0, last: row === SKELETON_ROWS.length - 1 }}
          />
        ))}
      </SheetScrollView>
    </Sheet>
  );
}
