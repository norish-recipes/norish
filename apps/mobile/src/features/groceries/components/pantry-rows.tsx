import React from "react";
import { Pressable, Text, View } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { IngredientIcon } from "@/components/ingredient-icon";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { PickedFood } from "@norish/shared-react/groceries";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { PantryRow } from "../utils/pantry-rows";
import { SkeletonCard } from "./groceries-states";

/** A kept food that still has a grocery to buy: handled, so nobody adds it twice. */
export function OnTheListChip() {
  const intl = useIntl();
  const accentText = useAccentTextColor();

  return (
    <View
      className="bg-accent/10 h-[30px] flex-row items-center gap-1 rounded-full pr-2.5 pl-2"
      testID="on-the-list"
    >
      <Ionicons color={accentText} name="checkmark" size={13} />
      <Text className="text-accent-text text-[13px] font-semibold">
        {intl.formatMessage({ id: "groceries.pantry.onTheList" })}
      </Text>
    </View>
  );
}

/** The round 36 pt button at the end of a row. */
export function RowButton({
  icon,
  label,
  testID,
  accent = false,
  onPress,
}: {
  icon: "cart-outline" | "add";
  label: string;
  testID: string;
  accent?: boolean;
  onPress: () => void;
}) {
  const [foreground] = useThemeColor(["foreground"] as const);
  const accentText = useAccentTextColor();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="bg-default size-9 items-center justify-center rounded-full"
      hitSlop={4}
      testID={testID}
      onPress={onPress}
    >
      <Ionicons
        color={accent ? accentText : foreground}
        name={icon}
        size={icon === "add" ? 20 : 17}
      />
    </Pressable>
  );
}

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
  empty: { testID: "pantry-empty", messageId: "groceries.pantry.empty" },
  noMatch: { testID: "pantry-no-match", messageId: "common.status.noResults" },
} as const;

const SECTION_LABEL = "text-muted text-xs font-semibold tracking-[0.6px] uppercase";

/** One row of the Pantry's flat list. */
export function PantryRowView({ row, actions }: { row: PantryRow; actions: PantryActions }) {
  const intl = useIntl();
  const accentText = useAccentTextColor();
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
                <RowButton
                  icon="cart-outline"
                  label={intl.formatMessage({ id: "groceries.pantry.putOnTheList" })}
                  testID={`pantry-put-${item.id}`}
                  onPress={() => actions.putOnTheList(item)}
                />
              )
            }
            ingredientId={item.ingredientId || null}
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
        <CardSlice edge={{ top: true, bottom: true }}>
          <Text className="text-muted px-4 py-[22px] text-center text-[15px]" testID={note.testID}>
            {intl.formatMessage({ id: note.messageId })}
          </Text>
        </CardSlice>
      );
    }
    case "label":
      return (
        <Text className={`${SECTION_LABEL} px-7 pt-[18px] pb-2`}>
          {intl.formatMessage({ id: "groceries.pantry.fromCatalogue" })}
        </Text>
      );
    case "match": {
      const food = row.food;
      const name = ingredientDisplayName(food, intl.locale);

      return (
        <CardSlice edge={row.edge}>
          <FoodRow
            end={
              <RowButton
                accent
                icon="add"
                label={addLabel(name)}
                testID={`pantry-match-${food.id}`}
                onPress={() =>
                  actions.keep({
                    ingredientId: food.id,
                    name: food.name,
                    localeNames: food.localeNames,
                  })
                }
              />
            }
            ingredientId={food.id}
            name={name}
            testID={`pantry-match-row-${food.id}`}
          />
        </CardSlice>
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
              <RowButton
                accent
                icon="add"
                label={addLabel(name)}
                testID={`pantry-suggestion-${food.ingredientId}`}
                onPress={() => actions.keep(food)}
              />
            }
            ingredientId={food.ingredientId}
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
      return (
        <Pressable
          accessibilityRole="button"
          className="px-7 pt-3"
          testID="pantry-show-more"
          onPress={actions.showMore}
        >
          <Text className="text-sm font-medium" style={{ color: accentText }}>
            {intl.formatMessage({ id: "groceries.pantry.showMore" })}
          </Text>
        </Pressable>
      );
  }
}

/** What the Pantry looks like while it loads: one card of rows, in the real shell. */
export function PantrySkeleton() {
  return (
    <View className="px-5 pt-3.5" testID="pantry-skeleton">
      <SkeletonCard rowClassName="h-[52px] gap-3 px-3.5" rows={6}>
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-5 w-36 rounded-md" />
      </SkeletonCard>
    </View>
  );
}
