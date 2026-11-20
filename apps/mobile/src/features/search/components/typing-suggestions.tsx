import type { ReactNode } from "react";
import React from "react";
import { ScrollView, View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { CardPhoto } from "@/components/card-photo";
import { HighlightedText } from "@/components/highlighted-text";
import { IngredientIcon, IngredientIconSlots } from "@/components/ingredient-icon";
import { Section } from "@/components/section";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import { usePlatform } from "@norish/shared-react/platform";
import { recipeCardFacts } from "@norish/shared-react/recipes";

import type { NarrowRow } from "../utils/search-suggestions";
import { narrowRowKey, RECIPE_SUGGESTIONS } from "../utils/search-suggestions";

const TYPE_LABELS = {
  ingredient: "recipes.search.typeIngredient",
  tag: "recipes.search.typeTag",
  category: "recipes.search.typeCategory",
} as const;

/** Rows as tall as the ones that replace them: a recipe's has a photo, a Narrow-to row's a small mark. */
function SkeletonRows({ count, photo, testID }: { count: number; photo: boolean; testID: string }) {
  return (
    <Card surface testID={testID}>
      {Array.from({ length: count }, (_, index) => (
        <CardRow
          key={index}
          first={index === 0}
          hint={<Skeleton className="h-3.5 w-24 rounded-md" />}
          label={<Skeleton className="h-4 w-40 rounded-md" />}
          leading={photo ? undefined : <Skeleton className="size-7 rounded-full" />}
          media={photo ? <Skeleton className="size-10 rounded-xl" /> : undefined}
        />
      ))}
    </Card>
  );
}

/** A heading over its rows, or over skeletons while loading; nothing for a kind with no rows. */
function SuggestionSection({
  title,
  loading,
  skeleton,
  empty,
  children,
}: {
  title: string;
  loading: boolean;
  skeleton: ReactNode;
  empty: boolean;
  children: ReactNode;
}) {
  if (!loading && empty) return null;

  return (
    <Section dense title={title}>
      {loading ? skeleton : children}
    </Section>
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
      label={<HighlightedText search={search} text={recipe.name} />}
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
      label={
        <HighlightedText search={search} text={row.kind === "category" ? row.label : row.name} />
      }
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
      <Card surface>
        <CardRow
          chevron={false}
          first
          label={intl.formatMessage({ id: "recipes.search.searchFor" }, { text: text.trim() })}
          leading={<Ionicons color={accent} name="search" size={18} />}
          testID="search-for-row"
          onPress={onConfirm}
        />
      </Card>
      <SuggestionSection
        empty={recipes.length === 0}
        loading={loading}
        skeleton={<SkeletonRows count={RECIPE_SUGGESTIONS} photo testID="search-recipes-loading" />}
        title={intl.formatMessage({ id: "recipes.search.recipes" })}
      >
        <Card surface>
          {recipes.map((recipe, index) => (
            <RecipeRow key={recipe.id} first={index === 0} recipe={recipe} search={searchWords} />
          ))}
        </Card>
      </SuggestionSection>
      <SuggestionSection
        empty={narrowRows.length === 0}
        loading={loading}
        skeleton={<SkeletonRows count={3} photo={false} testID="search-narrow-loading" />}
        title={intl.formatMessage({ id: "recipes.search.narrowTo" })}
      >
        <IngredientIconSlots
          rows={narrowRows.map((row) => ({ foodId: row.kind === "ingredient" ? row.id : null }))}
        >
          <Card surface>
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
      </SuggestionSection>
    </ScrollView>
  );
}
