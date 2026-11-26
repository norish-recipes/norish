import React from "react";
import { FlatList } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { CountRow } from "@/components/count-row";
import { EmptyCard } from "@/components/empty-card";
import { IngredientIcon, IngredientIconSlots } from "@/components/ingredient-icon";
import { Pill } from "@/components/pill";
import { SearchFilterRow } from "@/components/search-filter-row";
import { edgeAt } from "@/lib/card-edges";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useIngredientsSubscription } from "@norish/shared-react/config";
import {
  hasIngredientFilters,
  useIngredientFiltersStore,
  useIngredientIcons,
  useIngredientList,
} from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import { AiChangesRow } from "./ai-changes-row";
import { ContentSkeleton } from "./content-skeleton";

/** The catalogue of Ingredients: a tree of kinds unless searched or filtered, a page at a time. */
export function IngredientList() {
  const text = useText();
  const router = useRouter();
  const { locale } = useIntl();
  const filters = useIngredientFiltersStore((state) => state.filters);
  const [search, setSearch] = React.useState("");

  useIngredientsSubscription();

  const {
    items,
    isLoading,
    isPaused,
    isPlaceholderData,
    hasNextPage,
    fetchNextPage,
    treeMode,
    tree,
  } = useIngredientList(search, filters, locale);
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
              <CountRow
                depth={row.depth}
                fold={
                  treeMode
                    ? {
                        foldable,
                        expanded: row.expanded,
                        label: text(
                          row.expanded
                            ? "settings.ingredients.collapseKinds"
                            : "settings.ingredients.expandKinds",
                          { name }
                        ),
                        testID: `content-kinds-${row.item.id}`,
                        onPress: () => tree.toggle(row.item.id),
                      }
                    : undefined
                }
                leading={<IngredientIcon ingredientId={row.item.id} />}
                name={name}
                tag={
                  row.item.flagged ? (
                    <Pill size="tag" tone="warning">
                      {text("settings.ingredients.flagged")}
                    </Pill>
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
