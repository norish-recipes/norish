import type { RecipeCardItem } from "@/lib/recipes/recipe-card.types";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { NoImagePlaceholder } from "@/components/shared/no-image-placeholder";
import { styles } from "@/styles/recipe-card.styles";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Chip } from "heroui-native";

import { isAllergenTag, sortTagsWithAllergyPriority } from "@norish/shared/lib/helpers";

type RecipeCardImageProps = {
  recipe: RecipeCardItem;
  onPress?: () => void;
  onDoubleTapLike?: () => void;
};

const DOUBLE_TAP_DELAY = 300;

function RecipeCardImageComponent({ recipe, onPress, onDoubleTapLike }: RecipeCardImageProps) {
  const [hasError, setHasError] = useState(false);
  const singleTapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const allergies = recipe.allergies ?? [];
  const allergySet = React.useMemo(
    () => new Set(allergies.map((item) => item.toLowerCase())),
    [allergies]
  );
  const tags = React.useMemo(() => {
    return sortTagsWithAllergyPriority(
      (recipe.tags ?? []).map((name) => ({ name })),
      allergies
    ).map((tag) => tag.name);
  }, [recipe.tags, allergies]);

  const showPlaceholder = hasError || !recipe.imageUrl;

  // ── Double-tap heart animation ──────────────────────────────────────────
  const lastTap = useRef(0);
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const clearSingleTapTimeout = useCallback(() => {
    if (!singleTapTimeout.current) {
      return;
    }

    clearTimeout(singleTapTimeout.current);
    singleTapTimeout.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearSingleTapTimeout();
    };
  }, [clearSingleTapTimeout]);

  const handlePress = useCallback(() => {
    if (!onDoubleTapLike) {
      onPress?.();
      return;
    }

    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      lastTap.current = 0;
      clearSingleTapTimeout();

      if (recipe.liked) {
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      heartScale.value = 0;
      heartOpacity.value = 1;
      heartScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 400, mass: 0.6 }),
        withTiming(1.0, { duration: 100 }),
        withTiming(0, { duration: 200 })
      );
      heartOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 200 })
      );

      onDoubleTapLike();
    } else {
      lastTap.current = now;

      clearSingleTapTimeout();
      singleTapTimeout.current = setTimeout(() => {
        lastTap.current = 0;
        singleTapTimeout.current = null;
        onPress?.();
      }, DOUBLE_TAP_DELAY);
    }
  }, [clearSingleTapTimeout, heartOpacity, heartScale, onDoubleTapLike, onPress, recipe.liked]);

  return (
    <Pressable onPress={handlePress}>
      <View className="relative w-full overflow-hidden bg-black" style={styles.imageContainer}>
        {showPlaceholder ? (
          <NoImagePlaceholder variant="card" />
        ) : (
          <Image
            source={
              recipe.imageHeaders
                ? { uri: recipe.imageUrl, headers: recipe.imageHeaders }
                : { uri: recipe.imageUrl }
            }
            contentFit="cover"
            transition={300}
            style={styles.imageFill}
            onError={handleError}
          />
        )}

        {/* Double-tap heart overlay */}
        <Animated.View pointerEvents="none" style={[styles.heartOverlay, heartAnimatedStyle]}>
          <Ionicons name="heart" size={60} color="#ff4d6d" />
        </Animated.View>

        {tags.length > 0 ? (
          <View className="absolute inset-x-0 bottom-0 pb-2.5" pointerEvents="box-none">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagRow}
            >
              {tags.map((chip) => {
                const isAllergen = isAllergenTag(chip, allergySet);

                return (
                  <Chip
                    key={`${recipe.id}-${chip}`}
                    size="sm"
                    variant="soft"
                    color={isAllergen ? "warning" : "default"}
                    animation="disable-all"
                    className={isAllergen ? "shrink-0" : "shrink-0 bg-black/40 backdrop-blur-md"}
                  >
                    <Chip.Label className={`text-xs ${isAllergen ? "" : "text-white"}`}>
                      {chip}
                    </Chip.Label>
                  </Chip>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export const RecipeCardImage = React.memo(RecipeCardImageComponent);
