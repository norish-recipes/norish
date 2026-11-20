import React from "react";
import { ScrollView, View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { CardPhoto } from "@/components/card-photo";
import { HighlightedTitle } from "@/components/highlighted-text";
import { IngredientIcon, IngredientIconSlots } from "@/components/ingredient-icon";
import { SectionLabel } from "@/components/section-label";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import { usePlatform } from "@norish/shared-react/platform";
import { recipeCardFacts } from "@norish/shared-react/recipes";

import type { NarrowRow } from "../utils/search-suggestions";
import { narrowRowKey } from "../utils/search-suggestions";

const TYPE_LABELS = {
  ingredient: "recipes.search.typeIngredient",
  tag: "recipes.search.typeTag",
  category: "recipes.search.typeCategory",
} as const;

function SkeletonRows({ count, tall }: { count: number; tall: boolean }) {
  return (
    <Card testID="search-suggestions-loading">
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className={`${tall ? "min-h-[60px]" : "min-h-[52px]"} flex-row items-center gap-3 px-4`}
        >
          <Skeleton className={tall ? "size-10 rounded-xl" : "size-7 rounded-full"} />
          <Skeleton className="h-4 w-40 rounded-md" />
        </View>
      ))}
    </Card>
  );
}

function RecipeRow({
  recipe,
  search,
  first,
}: {
  recipe: RecipeDashboardDTO;
  search: string;
  first: boolean;
}) {
  const intl = useIntl();
  const { navigation } = usePlatform();
  const { timeLabel, servings } = recipeCardFacts(recipe, []);
  const facts = [
    timeLabel,
    servings ? intl.formatMessage({ id: "recipes.detail.servingsCount" }, { count: servings }) : "",
  ].filter(Boolean);

  return (
    <CardRow
      first={first}
      hint={facts.join(" · ")}
      label={<HighlightedTitle name={recipe.name} search={search} />}
      media={<CardPhoto className="size-10 overflow-hidden rounded-xl" image={recipe.image} />}
      testID={`search-suggestion-recipe-${recipe.id}`}
      chevron={false}
      onPress={() => navigation.toRecipe(recipe.id)}
    />
  );
}

function NarrowRowView({
  row,
  search,
  first,
  onNarrow,
}: {
  row: NarrowRow;
  search: string;
  first: boolean;
  onNarrow: (row: NarrowRow) => void;
}) {
  const intl = useIntl();
  const muted = useTokenColor("muted");

  return (
    <CardRow
      chevron={false}
      first={first}
      hint={intl.formatMessage({ id: TYPE_LABELS[row.kind] })}
      label={<HighlightedTitle name={row.name} search={search} />}
      leading={
        row.kind === "ingredient" ? (
          <IngredientIcon ingredientId={row.id} size={28} />
        ) : (
          <View className="bg-default size-7 items-center justify-center rounded-full">
            <Ionicons
              color={muted}
              name={row.kind === "tag" ? "pricetag-outline" : "apps-outline"}
              size={15}
            />
          </View>
        )
      }
      testID={`search-narrow-${narrowRowKey(row)}`}
      onPress={() => onNarrow(row)}
    >
      <Ionicons color={muted} name="add" size={18} />
    </CardRow>
  );
}

/** The typing state: the "Search for" row, the top recipes, and what to narrow to. Rows come with the
 * suggestions; until then the first row shows at once and skeletons stand for the rest. */
export function TypingSuggestions({
  text,
  loading,
  recipes,
  narrowRows,
  searchWords,
  onConfirm,
  onNarrow,
}: {
  text: string;
  loading: boolean;
  recipes: RecipeDashboardDTO[];
  narrowRows: NarrowRow[];
  /** The text the suggestions were asked for, which the hits are highlighted by. */
  searchWords: string;
  onConfirm: () => void;
  onNarrow: (row: NarrowRow) => void;
}) {
  const intl = useIntl();
  const accent = useTokenColor("accent-text");

  return (
    <ScrollView
      contentContainerClassName="gap-4.5 px-5 pt-5 pb-96"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      testID="search-typing"
    >
      <Card>
        <CardRow
          chevron={false}
          first
          label={intl.formatMessage({ id: "recipes.search.searchFor" }, { text: text.trim() })}
          leading={<Ionicons color={accent} name="search" size={18} />}
          testID="search-for-row"
          onPress={onConfirm}
        />
      </Card>
      {loading || recipes.length > 0 ? (
        <View className="gap-2">
          <SectionLabel>{intl.formatMessage({ id: "recipes.search.recipes" })}</SectionLabel>
          {loading ? (
            <SkeletonRows count={2} tall />
          ) : (
            <Card>
              {recipes.map((recipe, index) => (
                <RecipeRow
                  key={recipe.id}
                  first={index === 0}
                  recipe={recipe}
                  search={searchWords}
                />
              ))}
            </Card>
          )}
        </View>
      ) : null}
      {loading || narrowRows.length > 0 ? (
        <View className="gap-2">
          <SectionLabel>{intl.formatMessage({ id: "recipes.search.narrowTo" })}</SectionLabel>
          {loading ? (
            <SkeletonRows count={3} tall={false} />
          ) : (
            <IngredientIconSlots
              rows={narrowRows.map((row) => ({
                foodId: row.kind === "ingredient" ? row.id : null,
              }))}
            >
              <Card>
                {narrowRows.map((row, index) => (
                  <NarrowRowView
                    key={narrowRowKey(row)}
                    first={index === 0}
                    row={row}
                    search={searchWords}
                    onNarrow={onNarrow}
                  />
                ))}
              </Card>
            </IngredientIconSlots>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
