import React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { useFadeProgress } from "@/lib/motion/fade-to";
import { usePopOnChange } from "@/lib/motion/pop-on-change";
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

/** How long each star after the first waits, so a rating fills left to right. */
const STAR_STAGGER_MS = 45;
const STAR_SIZE = 34;

/** One star: the filled glyph fades in over the outline and swells, after its turn in the row. */
function Star({ order, filled }: { order: number; filled: boolean }) {
  const reduceMotion = useReducedMotion();
  const [star, muted] = useThemeColor(["warning", "muted"] as const);
  const delay = filled && !reduceMotion ? order * STAR_STAGGER_MS : 0;
  const fill = useFadeProgress(filled ? 1 : 0, delay);
  const pop = usePopOnChange(filled, delay);
  const filledStyle = useAnimatedStyle(() => ({ opacity: fill.get() }));

  return (
    <Animated.View style={pop}>
      <Ionicons color={muted} name="star-outline" size={STAR_SIZE} />
      <Animated.View className="absolute inset-0" style={filledStyle}>
        <Ionicons color={star} name="star" size={STAR_SIZE} />
      </Animated.View>
    </Animated.View>
  );
}

/** Five stars; the star that is already yours clears the rating. */
export function RatingSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const { showRatings } = useHiddenItemVisibility();
  const { userRating, averageRating } = useRatingQuery(recipe.id);
  const { rateRecipe } = useRatingsMutation();
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
              <Star filled={value <= shown} order={value - 1} />
            </Pressable>
          ))}
        </View>
      </View>
    </SectionCard>
  );
}
