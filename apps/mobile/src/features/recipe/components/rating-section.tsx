import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
} from "react-native-reanimated";
import { popAfter } from "@/lib/motion/pop-on-change";
import { settleTo } from "@/lib/motion/settle-to";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import {
  useLoadedPageRecipe,
  useRatingQuery,
  useRatingsMutation,
} from "@norish/shared-react/recipes";

import type { StarMotion, StarTap } from "../utils/star-motion";
import { liveTap, starMotion } from "../utils/star-motion";
import { SectionCard } from "./tint";

const STAR_SIZE = 34;

/** One star: the filled glyph over the outline. A tap's change fades it, and a fill swells it, after
 * its `motion` delay; with no `motion` (a value from the server) it is shown as it is. */
function Star({ filled, motion }: { filled: boolean; motion: StarMotion | null }) {
  const reduceMotion = useReducedMotion();
  const [star, muted] = useThemeColor(["warning", "muted"] as const);
  const fill = useSharedValue(filled ? 1 : 0);
  const scale = useSharedValue(1);
  const seenRef = useRef(filled);
  const filledStyle = useAnimatedStyle(() => ({ opacity: fill.get() }));
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  useEffect(() => {
    if (seenRef.current === filled) return;
    seenRef.current = filled;
    if (!motion) {
      fill.set(filled ? 1 : 0);

      return;
    }
    const delay = reduceMotion ? 0 : motion.delay;

    fill.set(withDelay(delay, settleTo(filled ? 1 : 0, { reduceMotion, overshootClamping: true })));
    if (motion.pop) scale.set(popAfter(delay, reduceMotion));
  }, [filled, motion, reduceMotion, fill, scale]);

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
  // The last tap: only its own change animates, once.
  const [tap, setTap] = useState<StarTap | null>(null);
  const live = liveTap(tap, shown);

  if (live !== tap) setTap(live);

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
              onPress={() => {
                const next = userRating === value ? null : value;

                setTap({ from: shown, to: Math.round(next ?? averageRating ?? 0), reached: false });
                rateRecipe(recipe.id, next);
              }}
            >
              <Star
                filled={value <= shown}
                motion={live?.reached ? starMotion(value, live.from, live.to) : null}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </SectionCard>
  );
}
