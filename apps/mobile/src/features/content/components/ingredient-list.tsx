import React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { CountRow } from "@/components/count-row";
import { EmptyCard } from "@/components/empty-card";
import { IngredientIcon, IngredientIconSlots } from "@/components/ingredient-icon";
import { SearchFilterRow } from "@/components/search-filter-row";
import { useTokenColor } from "@/hooks/use-token-color";
import { edgeAt } from "@/lib/card-edges";
import { useText } from "@/lib/i18n/use-text";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useIngredientsSubscription } from "@norish/shared-react/config";
import {
  hasIngredientFilters,
  useIngredientFiltersStore,
  useIngredientIcons,
  useIngredientListQuery,
  useIngredientTree,
} from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import { AiChangesRow } from "./ai-changes-row";
import { ContentSkeleton } from "./content-skeleton";

const INDENT = 24;

/** The catalogue of Ingredients: a tree of kinds unless searched or filtered, a page at a time. */
export function IngredientList() {
  const text = useText();
  const router = useRouter();
  const { locale } = useIntl();
  const muted = useTokenColor("muted");
  const filters = useIngredientFiltersStore((state) => state.filters);
  const [search, setSearch] = React.useState("");

  useIngredientsSubscription();

  // A search or filter may match at any depth, so only the unfiltered list is a tree of roots.
  const { tree: asTree, ...searchFilters } = filters;
  const treeMode = asTree && !search && !hasIngredientFilters({ ...searchFilters, tree: true });
  const { items, isLoading, isPaused, isPlaceholderData, hasNextPage, fetchNextPage } =
    useIngredientListQuery({
      search: search || undefined,
      ...searchFilters,
      rootsOnly: treeMode || undefined,
      locale,
    });
  const tree = useIngredientTree(items, treeMode, locale);
  const rows = tree.rows.map((row) => ({ ...row, foodId: row.item.id }));

  useIngredientIcons(rows.map((row) => row.foodId));

  if (isLoading || (isPlaceholderData && items.length === 0 && !isPaused)) {
    return <ContentSkeleton />;
  }

  const header = (
    <>
      <SearchFilterRow
        filter={{
          label: text("common.filters.title"),
          active: hasIngredientFilters(filters),
          testID: "content-filter",
          onPress: () => router.push("/settings/ingredient-filters"),
        }}
        label={text("settings.ingredients.search")}
        testID="content-search"
        value={search}
        onChange={setSearch}
      />
      <AiChangesRow onPress={() => router.push("/settings/ingredient-changes")} />
      {rows.length === 0 ? (
        <EmptyCard
          icon="leaf-outline"
          placement="screen"
          testID="content-empty"
          title={text(
            filters.flaggedOnly ? "settings.ingredients.emptyFlagged" : "settings.ingredients.empty"
          )}
        />
      ) : null}
    </>
  );

  return (
    <IngredientIconSlots rows={rows}>
      <FlatList
        ListHeaderComponent={header}
        contentContainerClassName="pb-16"
        contentInsetAdjustmentBehavior="never"
        data={rows}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(row) => row.item.id}
        renderItem={({ item: row, index }) => {
          const name = ingredientDisplayName(row.item, locale);
          const foldable = treeMode && row.item.kinds > 0;

          return (
            <CardSlice edge={edgeAt(index, rows.length)}>
              <View className="flex-row items-center">
                {treeMode ? (
                  <Pressable
                    accessibilityLabel={text(
                      row.expanded
                        ? "settings.ingredients.collapseKinds"
                        : "settings.ingredients.expandKinds",
                      { name }
                    )}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: foldable ? row.expanded : undefined }}
                    className="w-9 items-center justify-center self-stretch pl-2"
                    disabled={!foldable}
                    style={{ marginLeft: row.depth * INDENT }}
                    testID={`content-kinds-${row.item.id}`}
                    onPress={() => tree.toggle(row.item.id)}
                  >
                    {foldable ? (
                      <Ionicons
                        color={muted}
                        name={row.expanded ? "chevron-down" : "chevron-forward"}
                        size={16}
                      />
                    ) : null}
                  </Pressable>
                ) : null}
                <View className="min-w-0 flex-1">
                  <CountRow
                    leading={<IngredientIcon ingredientId={row.item.id} />}
                    name={name}
                    tag={
                      row.item.flagged ? (
                        <Text className="text-warning-ink bg-warning/30 overflow-hidden rounded-full px-2 py-0.5 text-xs font-medium">
                          {text("settings.ingredients.flagged")}
                        </Text>
                      ) : undefined
                    }
                    testID={`content-ingredient-${row.item.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/settings/ingredient",
                        params: { id: row.item.id },
                      })
                    }
                  />
                </View>
              </View>
            </CardSlice>
          );
        }}
        showsVerticalScrollIndicator={false}
        testID="content-list"
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
      />
    </IngredientIconSlots>
  );
}
