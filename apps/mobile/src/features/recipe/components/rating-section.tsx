import React from "react";
import { Text, View } from "react-native";
import { StarRating } from "@/components/star-rating";
import { useIntl } from "react-intl";

import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import {
  useLoadedPageRecipe,
  useRatingQuery,
  useRatingsMutation,
} from "@norish/shared-react/recipes";

import { SectionCard } from "./tint";

/** Five stars; the star that is already yours clears the rating. */
export function RatingSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const { showRatings } = useHiddenItemVisibility();
  const { userRating, averageRating } = useRatingQuery(recipe.id);
  const { rateRecipe } = useRatingsMutation();

  if (!showRatings) return null;

  return (
    <SectionCard testID="recipe-rating">
      <View className="items-center gap-3 pt-3.5 pb-1">
        <Text className="text-muted text-base font-medium">
          {intl.formatMessage({ id: "recipes.detail.ratingPrompt" })}
        </Text>
        <StarRating
          fallback={averageRating}
          labelFor={(count) => intl.formatMessage({ id: "recipes.detail.rateStars" }, { count })}
          testID="recipe-rate"
          value={userRating}
          onChange={(next) => rateRecipe(recipe.id, next)}
        />
      </View>
    </SectionCard>
  );
}
