import type { CardActions } from "@/hooks/use-card-actions";
import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { GestureDetector, useTapGesture } from "react-native-gesture-handler";
import { CardPhoto } from "@/components/card-photo";
import { PressTap } from "@/components/press-tap";
import { lightImpact } from "@/lib/haptics";
import { recipeRoute } from "@/lib/tab-routes";
import { useIntl } from "react-intl";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { usePlatform } from "@norish/shared-react/platform";
import { recipeCardFacts } from "@norish/shared-react/recipes";

import type { RecipeMenuAction } from "../utils/card-actions";
import type { SwipeAction } from "./swipe-actions";
import { useCardActionMenu } from "../hooks/use-card-action-menu";
import {
  RECIPE_ACTION_DEFINITIONS,
  recipeMenuActions,
  recipeSwipeActions,
} from "../utils/card-actions";
import { CardMenu } from "./card-menu";
import { FavouriteMark } from "./favourite-mark";
import { Pill } from "./pill";
import { SwipeActions } from "./swipe-actions";
import { TAG_GAP, TagChips } from "./tag-chips";

type Props = {
  recipe: RecipeDashboardDTO;
  variant: RecipeViewMode;
  isFavorite: boolean;
  allergies: string[];
  actions: CardActions;
};

/** A recipe in the Library as a row or grid card; its photo double-tap favourites, swipe and long press offer actions. */
export function RecipeCard({ recipe, variant, isFavorite, allergies, actions }: Props) {
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
    removeFromCookbook: () => actions.removeFromCookbook(recipe),
    delete: () => actions.deleteRecipe(recipe),
  };
  const definition = (key: RecipeMenuAction) =>
    RECIPE_ACTION_DEFINITIONS[key === "favourite" && isFavorite ? "unfavourite" : key];
  const { items, accessibilityProps } = useCardActionMenu(
    recipeMenuActions({
      canDelete,
      canRemoveFromCookbook: actions.canRemoveFromCookbook,
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
      lightImpact();
      handlers.favourite();
    },
  });

  return (
    <SwipeActions actions={swipe} variant={variant}>
      <View
        accessible
        {...accessibilityProps}
        accessibilityLabel={
          isFavorite
            ? `${recipe.name}, ${intl.formatMessage({ id: "recipes.dashboard.favourited" })}`
            : recipe.name
        }
        accessibilityRole="button"
        className={variant === "grid" ? "flex-1" : undefined}
        testID={`recipe-card-${recipe.id}`}
        onAccessibilityTap={open}
      >
        <CardMenu href={recipeRoute(recipe.id)} items={items}>
          <PressTap
            className={variant === "grid" ? "flex-1" : undefined}
            requireToFail={doubleTap}
            onPress={open}
          >
            <Card facts={facts} isFavorite={isFavorite} photoGesture={doubleTap} recipe={recipe} />
          </PressTap>
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
        <View className="mt-auto flex-row overflow-hidden" style={{ gap: TAG_GAP }}>
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
          <TagChips
            allergySet={allergySet}
            look="plain"
            tags={tagNames}
            testID={`recipe-card-tags-${recipe.id}`}
          />
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
        <TagChips
          allergySet={allergySet}
          look="glass"
          tags={tagNames}
          testID={`recipe-card-tags-${recipe.id}`}
        />
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
