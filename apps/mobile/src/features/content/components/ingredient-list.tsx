import React from "react";
import { CardSlice } from "@/components/card-slice";
import { CountRow } from "@/components/count-row";
import { IngredientIcon, IngredientIconSlots } from "@/components/ingredient-icon";
import { ListFrame } from "@/components/list-frame";
import { ListHeading } from "@/components/list-heading";
import { HeadingRow } from "@/components/section-rows";
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
import { useIngredientCount } from "@norish/shared-react/lists";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import { AiChangesRow } from "./ai-changes-row";

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
    failed,
    retry,
    isPaused,
    isPlaceholderData,
    hasNextPage,
    fetchNextPage,
    treeMode,
    tree,
  } = useIngredientList(search, filters, locale);
  const total = useIngredientCount();
  const rows = tree.rows.map((row) => ({ ...row, foodId: row.item.id }));
  // The total is of the whole list, so a search or filter leaves the heading off.
  const headed =
    total !== undefined && !search && !hasIngredientFilters({ ...filters, tree: true });
  const data = [
    ...(headed ? [{ type: "heading" as const, key: "heading-count", count: total ?? 0 }] : []),
    ...rows.map((row, index) => ({ type: "row" as const, key: row.item.id, row, index })),
  ];

  useIngredientIcons(rows.map((row) => row.foodId));

  return (
    <IngredientIconSlots always rows={rows}>
      <ListFrame
        above={<AiChangesRow onPress={() => router.push("/settings/ingredient-changes")} />}
        data={data}
        failed={failed ? { title: text("settings.content.loadFailed"), onRetry: retry } : undefined}
        keyExtractor={(each) => each.key}
        loading={isLoading || (isPlaceholderData && items.length === 0 && !isPaused)}
        nothing={
          rows.length === 0
            ? {
                icon: "leaf-outline",
                testID: "content-empty",
                title: text(
                  filters.flaggedOnly
                    ? "settings.ingredients.emptyFlagged"
                    : "settings.ingredients.empty"
                ),
              }
            : undefined
        }
        renderItem={({ item }) => {
          if (item.type === "heading") {
            return (
              <HeadingRow first>
                <ListHeading
                  testID={item.key}
                  title={text("settings.content.count.ingredient", { count: item.count })}
                />
              </HeadingRow>
            );
          }

          const { row, index } = item;
          const name = ingredientDisplayName(row.item, locale);
          const foldable = treeMode && row.item.kinds > 0;

          return (
            <CardSlice edge={edgeAt(index, rows.length)}>
              <CountRow
                depth={row.depth}
                // Every row keeps the fold's slot, so a name sits as far in under a search.
                fold={{
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
                }}
                leading={<IngredientIcon ingredientId={row.item.id} />}
                name={name}
                tag={row.item.flagged ? text("settings.ingredients.flagged") : undefined}
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
        search={{
          filter: {
            label: text("common.filters.title"),
            active: hasIngredientFilters(filters),
            testID: "content-filter",
            onPress: () => router.push("/settings/ingredient-filters"),
          },
          label: text("settings.ingredients.search"),
          testID: "content-search",
          value: search,
          onChange: setSearch,
        }}
        testID="content"
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
      />
    </IngredientIconSlots>
  );
}
