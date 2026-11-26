import React from "react";
import { Pressable, Text, View } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { EmptyCard } from "@/components/empty-card";
import { IconButton } from "@/components/icon-button";
import { IngredientIcon } from "@/components/ingredient-icon";
import { useOnSheet } from "@/components/on-sheet";
import { OnTheListChip } from "@/components/on-the-list-chip";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { PickedFood } from "@norish/shared-react/groceries";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { PantryRow } from "../utils/pantry-rows";
import { SkeletonCard } from "./groceries-states";

/** One food of the Pantry's lists: its icon, its name, what it says under the name, and an end. */
export function FoodRow({
  ingredientId,
  name,
  subline,
  testID,
  onPress,
  end,
}: {
  ingredientId: string | null;
  name: string;
  subline?: string;
  testID: string;
  /** A tap on the row; none where the row only holds its end. */
  onPress?: () => void;
  end: React.ReactNode;
}) {
  return (
    <View className="min-h-[52px] flex-row items-center gap-3 pr-2.5 pl-3.5" testID={testID}>
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        className="min-h-[52px] min-w-0 flex-1 flex-row items-center gap-3"
        disabled={!onPress}
        onPress={onPress}
      >
        <IngredientIcon ingredientId={ingredientId} />
        <View className="min-w-0 flex-1">
          <Text className="text-foreground text-base" numberOfLines={1}>
            {name}
          </Text>
          {subline ? (
            <Text className="text-muted text-[13px]" numberOfLines={1}>
              {subline}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {end}
    </View>
  );
}

/** What a row of the Pantry can do. */
export type PantryActions = {
  open: (item: PantryIngredientDto) => void;
  putOnTheList: (item: PantryIngredientDto) => void;
  keep: (food: string | PickedFood) => void;
  /** Folds "From your recipes" away when it is `open`, else opens it. */
  fold: (open: boolean) => void;
  showMore: () => void;
};

/** The note rows' test ids and messages. */
const NOTES = {
  empty: { testID: "pantry-empty", messageId: "groceries.pantry.empty", icon: "archive-outline" },
  noMatch: {
    testID: "pantry-no-match",
    messageId: "common.status.noResults",
    icon: "search-outline",
  },
} as const;

const SECTION_LABEL = "text-muted text-xs font-semibold tracking-[0.6px] uppercase";

/** One row of the Pantry's flat list. */
export function PantryRowView({ row, actions }: { row: PantryRow; actions: PantryActions }) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const addLabel = (name: string) =>
    intl.formatMessage({ id: "groceries.pantry.addFood" }, { name });

  switch (row.type) {
    case "kept": {
      const item = row.item;

      return (
        <CardSlice edge={row.edge}>
          <FoodRow
            end={
              row.onList ? (
                <OnTheListChip />
              ) : (
                <IconButton
                  icon="cart-outline"
                  label={intl.formatMessage({ id: "groceries.pantry.putOnTheList" })}
                  testID={`pantry-put-${item.id}`}
                  onPress={() => actions.putOnTheList(item)}
                />
              )
            }
            ingredientId={row.foodId}
            name={ingredientDisplayName(item, intl.locale)}
            testID={`pantry-food-${item.id}`}
            onPress={() => actions.open(item)}
          />
        </CardSlice>
      );
    }
    case "note": {
      const note = NOTES[row.text];

      return (
        <EmptyCard
          icon={note.icon}
          testID={note.testID}
          title={intl.formatMessage({ id: note.messageId })}
        />
      );
    }
    case "suggestions":
      return (
        <View className="px-7 pt-[18px] pb-2">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: row.open }}
            className="flex-row items-center gap-1.5 self-start"
            testID="pantry-suggestions"
            onPress={() => actions.fold(row.open)}
          >
            <Ionicons
              color={muted}
              name={row.open ? "chevron-down" : "chevron-forward"}
              size={14}
            />
            <Text className={SECTION_LABEL}>
              {intl.formatMessage({ id: "groceries.pantry.fromYourRecipes" })}
            </Text>
          </Pressable>
          {row.open ? (
            <Text className="text-muted pt-1 text-sm">
              {intl.formatMessage({ id: "groceries.pantry.fromYourRecipesHint" })}
            </Text>
          ) : null}
        </View>
      );
    case "suggestion": {
      const food = row.food;
      const name = ingredientDisplayName(food, intl.locale);

      return (
        <CardSlice edge={row.edge}>
          <FoodRow
            end={
              <IconButton
                icon="add"
                label={addLabel(name)}
                testID={`pantry-suggestion-${food.ingredientId}`}
                tone="accent"
                onPress={() => actions.keep(food)}
              />
            }
            ingredientId={row.foodId}
            name={name}
            subline={intl.formatMessage(
              { id: "groceries.pantry.inRecipes" },
              { count: food.recipeCount }
            )}
            testID={`pantry-suggestion-row-${food.ingredientId}`}
          />
        </CardSlice>
      );
    }
    case "more":
      return <ShowMore onPress={actions.showMore} />;
  }
}

/** "From your recipes"' Show more, under the suggestions it hides. */
export function ShowMore({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  const accentText = useAccentTextColor();

  return (
    <Pressable
      accessibilityRole="button"
      className="px-7 pt-3"
      testID="pantry-show-more"
      onPress={onPress}
    >
      <Text className="text-sm font-medium" style={{ color: accentText }}>
        {intl.formatMessage({ id: "groceries.pantry.showMore" })}
      </Text>
    </Pressable>
  );
}

/** What the Pantry looks like while it loads: one card of rows, in the real shell. */
export function PantrySkeleton() {
  return (
    <View className="pt-3.5" testID="pantry-skeleton">
      <FoodRowsSkeleton rows={6} />
    </View>
  );
}

/** A card of food rows still to come, on a sheet's fill there. */
export function FoodRowsSkeleton({ rows, testID }: { rows: number; testID?: string }) {
  const onSheet = useOnSheet();

  return (
    <View className="px-5" testID={testID}>
      <SkeletonCard
        className={onSheet ? "bg-sand" : "bg-surface"}
        rowClassName="h-[52px] gap-3 px-3.5"
        rows={rows}
      >
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-5 w-36 rounded-md" />
      </SkeletonCard>
    </View>
  );
}
