import React from "react";
import { Pressable, Text, View } from "react-native";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { usePlatform } from "@norish/shared-react/platform";
import { recipeCardFacts } from "@norish/shared-react/recipes";
import { isAllergenTag } from "@norish/shared/lib/helpers";

import { CardPhoto } from "./card-photo";
import { FavouriteMark } from "./favourite-mark";
import { Pill } from "./pill";

type Props = {
  recipe: RecipeDashboardDTO;
  variant: RecipeViewMode;
  isFavorite: boolean;
  allergies: string[];
};

/** A recipe in the Library, as a row or a grid card; a press opens it. */
export function RecipeCard({ recipe, variant, isFavorite, allergies }: Props) {
  const { navigation } = usePlatform();
  const { tagNames, allergySet, timeLabel, servings } = recipeCardFacts(recipe, allergies);
  const description = recipe.description?.trim() ?? "";
  const open = () => navigation.toRecipe(recipe.id);

  return variant === "grid" ? (
    <GridCard
      allergySet={allergySet}
      description={description}
      isFavorite={isFavorite}
      recipe={recipe}
      servings={servings}
      tagNames={tagNames}
      timeLabel={timeLabel}
      onPress={open}
    />
  ) : (
    <RowCard
      allergySet={allergySet}
      description={description}
      isFavorite={isFavorite}
      recipe={recipe}
      servings={servings}
      tagNames={tagNames}
      timeLabel={timeLabel}
      onPress={open}
    />
  );
}

type CardProps = {
  recipe: RecipeDashboardDTO;
  description: string;
  isFavorite: boolean;
  tagNames: string[];
  allergySet: Set<string>;
  timeLabel: string | null | undefined;
  servings: number | null;
  onPress: () => void;
};

function RowCard({
  recipe,
  description,
  isFavorite,
  tagNames,
  allergySet,
  timeLabel,
  servings,
  onPress,
}: CardProps) {
  const [firstTag, ...otherTags] = tagNames;
  const overflowIsAllergen = otherTags.some((tag) => isAllergenTag(tag, allergySet));

  return (
    <Pressable
      accessibilityRole="button"
      className="bg-surface h-[116px] flex-row overflow-hidden rounded-[20px]"
      testID={`recipe-card-${recipe.id}`}
      onPress={onPress}
    >
      <View className="h-[116px] w-[108px]">
        <CardPhoto className="h-[116px] w-[108px]" image={recipe.image} />
        {isFavorite ? <FavouriteMark size={28} /> : null}
      </View>
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
    </Pressable>
  );
}

function GridCard({
  recipe,
  description,
  isFavorite,
  tagNames,
  allergySet,
  timeLabel,
  servings,
  onPress,
}: CardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className="bg-surface border-border h-[286px] flex-1 overflow-hidden rounded-3xl border"
      testID={`recipe-card-${recipe.id}`}
      onPress={onPress}
    >
      <View className="h-40">
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
      </View>
      <View className="min-h-0 flex-1 px-3 pt-2.5 pb-3">
        <Text className="text-foreground text-sm leading-[19px] font-semibold" numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text className="text-muted mt-0.5 text-xs" numberOfLines={1}>
          {description}
        </Text>
        <View className="border-border mt-auto flex-row gap-1 overflow-hidden border-t pt-2.5">
          {timeLabel ? (
            <Pill icon="time-outline" size="foot">
              {timeLabel}
            </Pill>
          ) : null}
          {servings ? (
            <Pill icon="people-outline" size="foot">
              {servings}
            </Pill>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
