import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { GestureDetector, useTapGesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { usePlatform } from "@norish/shared-react/platform";
import { recipeCardFacts } from "@norish/shared-react/recipes";
import { isAllergenTag } from "@norish/shared/lib/helpers";

import type { CardActions } from "../hooks/use-card-actions";
import type { RecipeMenuAction } from "../utils/card-actions";
import type { SwipeAction } from "./swipe-actions";
import { useCardActionMenu } from "../hooks/use-card-action-menu";
import {
  recipeActionDefinition,
  recipeMenuActions,
  recipeSwipeActions,
} from "../utils/card-actions";
import { CardMenu } from "./card-menu";
import { CardPhoto } from "./card-photo";
import { FavouriteMark } from "./favourite-mark";
import { Pill } from "./pill";
import { SwipeActions } from "./swipe-actions";

type Props = {
  recipe: RecipeDashboardDTO;
  variant: RecipeViewMode;
  isFavorite: boolean;
  allergies: string[];
  actions: CardActions;
  /** The cookbook the card is shown in, which adds Remove from cookbook to its menu. */
  cookbook?: CookbookSummaryDTO;
};

/** A recipe in the Library as a row or grid card; its photo double-tap favourites, swipe and long press offer actions. */
export function RecipeCard({ recipe, variant, isFavorite, allergies, actions, cookbook }: Props) {
  const intl = useIntl();
  const { navigation } = usePlatform();
  const facts = recipeCardFacts(recipe, allergies);
  const Card = variant === "grid" ? GridCard : RowCard;
  const canDelete = actions.canDelete(recipe);
  const handlers: Record<RecipeMenuAction, () => void> = {
    favourite: () => actions.toggleFavourite(recipe),
    groceries: () => actions.addToGroceries(recipe),
    plan: () => actions.plan(recipe),
    addToCookbook: () => actions.addToCookbook(recipe),
    removeFromCookbook: () => cookbook && actions.removeFromCookbook(cookbook, recipe),
    delete: () => actions.deleteRecipe(recipe),
  };
  const definition = (key: RecipeMenuAction) => recipeActionDefinition(key, isFavorite);
  const { items, accessibilityProps } = useCardActionMenu(
    recipeMenuActions({
      canDelete,
      canRemoveFromCookbook: cookbook ? actions.canEdit(cookbook) : false,
    }),
    definition,
    handlers
  );
  const swipe: SwipeAction[] = recipeSwipeActions(canDelete).map((key) => {
    const { labelId, swipeLabelId } = definition(key);

    return {
      key,
      label: intl.formatMessage({ id: swipeLabelId ?? labelId }),
      onPress: handlers[key],
      testID: `recipe-swipe-${key}-${recipe.id}`,
    };
  });
  const open = () => navigation.toRecipe(recipe.id);
  // The single tap waits on the double tap, which only the photo owns.
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 250,
    runOnJS: true,
    onActivate: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      handlers.favourite();
    },
  });
  const singleTap = useTapGesture({ runOnJS: true, requireToFail: doubleTap, onActivate: open });

  return (
    <SwipeActions actions={swipe} variant={variant}>
      <View
        accessible
        {...accessibilityProps}
        accessibilityLabel={
          isFavorite
            ? `${recipe.name}, ${intl.formatMessage({ id: "recipes.actions.favourite" })}`
            : recipe.name
        }
        accessibilityRole="button"
        className={variant === "grid" ? "flex-1" : undefined}
        testID={`recipe-card-${recipe.id}`}
        onAccessibilityTap={open}
      >
        <CardMenu href={{ pathname: "/recipe/[id]", params: { id: recipe.id } }} items={items}>
          <GestureDetector gesture={singleTap}>
            <Card facts={facts} isFavorite={isFavorite} photoGesture={doubleTap} recipe={recipe} />
          </GestureDetector>
        </CardMenu>
      </View>
    </SwipeActions>
  );
}

type CardProps = {
  recipe: RecipeDashboardDTO;
  facts: ReturnType<typeof recipeCardFacts>;
  isFavorite: boolean;
  /** The double tap the photo owns. */
  photoGesture: ReturnType<typeof useTapGesture>;
};

function DoubleTapPhoto({
  gesture,
  className,
  children,
}: {
  gesture: CardProps["photoGesture"];
  className: string;
  children: ReactNode;
}) {
  return (
    <GestureDetector gesture={gesture}>
      <View className={className}>{children}</View>
    </GestureDetector>
  );
}

function RowCard({ recipe, facts, isFavorite, photoGesture }: CardProps) {
  const { description, tagNames, allergySet, timeLabel, servings } = facts;
  const [firstTag, ...otherTags] = tagNames;
  const overflowIsAllergen = otherTags.some((tag) => isAllergenTag(tag, allergySet));

  return (
    <View className="bg-surface h-[116px] flex-row overflow-hidden rounded-[20px]">
      <DoubleTapPhoto className="h-[116px] w-[108px]" gesture={photoGesture}>
        <CardPhoto className="h-[116px] w-[108px]" image={recipe.image} />
        {isFavorite ? <FavouriteMark size={28} /> : null}
      </DoubleTapPhoto>
      <View className="min-w-0 flex-1 gap-[3px] px-3.5 py-3">
        <Text
          className="text-foreground text-base font-semibold"
          ellipsizeMode="tail"
          numberOfLines={1}
        >
          {recipe.name}
        </Text>
        <Text className="text-muted text-sm" ellipsizeMode="tail" numberOfLines={1}>
          {description}
        </Text>
        <View className="mt-auto flex-row gap-1.5 overflow-hidden">
          {timeLabel ? (
            <Pill icon="time-outline" size="row">
              {timeLabel}
            </Pill>
          ) : null}
          {servings ? (
            <Pill icon="people-outline" size="row">
              {servings}
            </Pill>
          ) : null}
          {firstTag ? (
            <Pill
              icon={isAllergenTag(firstTag, allergySet) ? "warning-outline" : undefined}
              size="row"
              tone={isAllergenTag(firstTag, allergySet) ? "warning" : "default"}
            >
              {firstTag}
            </Pill>
          ) : null}
          {otherTags.length > 0 ? (
            <Pill size="row" tone={overflowIsAllergen ? "warning" : "default"}>
              {`+${otherTags.length}`}
            </Pill>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function GridCard({ recipe, facts, isFavorite, photoGesture }: CardProps) {
  const { description, tagNames, allergySet, timeLabel, servings } = facts;

  return (
    <View className="bg-surface border-border h-[286px] overflow-hidden rounded-3xl border">
      <DoubleTapPhoto className="h-40" gesture={photoGesture}>
        <CardPhoto className="h-40 w-full" image={recipe.image} />
        {isFavorite ? <FavouriteMark size={32} /> : null}
        <View className="absolute inset-x-0 bottom-0 flex-row gap-1.5 overflow-hidden p-2">
          {tagNames.slice(0, 3).map((tag) => {
            const allergen = isAllergenTag(tag, allergySet);

            return (
              <Pill
                key={tag}
                icon={allergen ? "warning-outline" : undefined}
                size="overlay"
                tone={allergen ? "warning" : "surface"}
              >
                {tag}
              </Pill>
            );
          })}
        </View>
      </DoubleTapPhoto>
      <View className="min-h-0 flex-1 px-3 pt-2.5 pb-3">
        <Text className="text-foreground text-sm leading-[19px] font-semibold" numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text className="text-muted mt-0.5 text-xs" numberOfLines={1}>
          {description}
        </Text>
        <View className="border-border mt-auto flex-row gap-1 overflow-hidden border-t pt-2.5">
          {timeLabel ? (
            <Pill icon="time-outline" size="footer">
              {timeLabel}
            </Pill>
          ) : null}
          {servings ? (
            <Pill icon="people-outline" size="footer">
              {servings}
            </Pill>
          ) : null}
        </View>
      </View>
    </View>
  );
}
