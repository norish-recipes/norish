import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
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
  const [star, muted] = useThemeColor(["warning", "muted"] as const);
  const shown = Math.round(userRating ?? averageRating ?? 0);

  if (!showRatings) return null;

  return (
    <SectionCard testID="recipe-rating">
      <View className="items-center gap-3 pt-3.5 pb-1">
        <Text className="text-muted text-base font-medium">
          {intl.formatMessage({ id: "recipes.detail.ratingPrompt" })}
        </Text>
        <View accessibilityRole="radiogroup" className="flex-row gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              accessibilityLabel={intl.formatMessage(
                { id: "recipes.detail.rateStars" },
                { count: value }
              )}
              accessibilityRole="radio"
              accessibilityState={{ checked: userRating === value }}
              hitSlop={4}
              testID={`recipe-rate-${value}`}
              onPress={() => rateRecipe(recipe.id, userRating === value ? null : value)}
            >
              <Ionicons
                color={value <= shown ? star : muted}
                name={value <= shown ? "star" : "star-outline"}
                size={34}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </SectionCard>
  );
}
