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
import type { MenuItem } from "./card-menu";
import type { SwipeAction } from "./swipe-actions";
import { recipeMenuActions, recipeSwipeActions } from "../utils/card-actions";
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

/** A recipe in the Library, as a row or a grid card: a tap opens it, a double tap on the photo favourites it, a swipe or long press offers the actions. */
export function RecipeCard({ recipe, variant, isFavorite, allergies, actions, cookbook }: Props) {
  const intl = useIntl();
  const { navigation } = usePlatform();
  const facts = recipeCardFacts(recipe, allergies);
  const Card = variant === "grid" ? GridCard : RowCard;
  const label = (id: string) => intl.formatMessage({ id });
  const canDelete = actions.canDelete(recipe);
  const runs: Record<string, () => void> = {
    favourite: () => actions.toggleFavourite(recipe),
    groceries: () => actions.addToGroceries(recipe),
    plan: () => actions.plan(recipe),
    addToCookbook: () => actions.addToCookbook(recipe),
    removeFromCookbook: () => cookbook && actions.removeFromCookbook(cookbook, recipe),
    delete: () => actions.deleteRecipe(recipe),
  };
  const labels: Record<string, string> = {
    favourite: label(isFavorite ? "recipes.actions.unfavourite" : "recipes.actions.favourite"),
    groceries: label("recipes.detail.addToGroceries"),
    plan: label("recipes.actions.plan"),
    addToCookbook: label("recipes.selection.addToCookbook"),
    removeFromCookbook: label("recipes.cookbooks.removeFromCookbook"),
    delete: label("recipes.actions.delete"),
  };
  const icons: Record<string, MenuItem["icon"]> = {
    favourite: isFavorite ? "heart.fill" : "heart",
    groceries: "bag",
    plan: "calendar",
    addToCookbook: "book",
    removeFromCookbook: "minus.circle",
    delete: "trash",
  };
  const menu: MenuItem[] = recipeMenuActions({
    canDelete,
    canRemoveFromCookbook: cookbook ? actions.canRemoveFromCookbook(cookbook) : false,
  }).map((key) => ({
    key,
    label: labels[key] ?? "",
    icon: icons[key],
    destructive: key === "delete" || key === "removeFromCookbook",
    onPress: runs[key] ?? (() => undefined),
  }));
  const swipe: SwipeAction[] = recipeSwipeActions(canDelete).map((key) => ({
    key,
    label: key === "groceries" ? label("recipes.actions.groceries") : (labels[key] ?? ""),
    onPress: runs[key] ?? (() => undefined),
    testID: `recipe-swipe-${key}-${recipe.id}`,
  }));
  const open = () => navigation.toRecipe(recipe.id);
  // The single tap waits for the double tap only when the touch began on the photo, which is the double tap's only view.
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 250,
    runOnJS: true,
    onActivate: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      runs.favourite?.();
    },
  });
  const singleTap = useTapGesture({ runOnJS: true, requireToFail: doubleTap, onActivate: open });

  return (
    <SwipeActions actions={swipe} variant={variant}>
      <CardMenu href={{ pathname: "/recipe/[id]", params: { id: recipe.id } }} items={menu}>
        <View
          accessible
          accessibilityActions={menu.map(({ key, label: name }) => ({ name: key, label: name }))}
          accessibilityLabel={recipe.name}
          accessibilityRole="button"
          className={variant === "grid" ? "flex-1" : undefined}
          testID={`recipe-card-${recipe.id}`}
          onAccessibilityAction={({ nativeEvent }) => runs[nativeEvent.actionName]?.()}
          onAccessibilityTap={open}
        >
          <GestureDetector gesture={singleTap}>
            <Card facts={facts} isFavorite={isFavorite} photoGesture={doubleTap} recipe={recipe} />
          </GestureDetector>
        </View>
      </CardMenu>
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

function Photo({
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
      <Photo className="h-[116px] w-[108px]" gesture={photoGesture}>
        <CardPhoto className="h-[116px] w-[108px]" image={recipe.image} />
        {isFavorite ? <FavouriteMark size={28} /> : null}
      </Photo>
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
      <Photo className="h-40" gesture={photoGesture}>
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
      </Photo>
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
