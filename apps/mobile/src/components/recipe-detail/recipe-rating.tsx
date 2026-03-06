import Ionicons from '@expo/vector-icons/Ionicons';
import { useThemeColor } from 'heroui-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type RecipeRatingProps = {
  /** Current rating value (1–5), or 0 if unrated. */
  value: number;
  /** Called when the user taps a star. */
  onRate?: (rating: number) => void;
  /** Optional text prompt shown above the stars. */
  prompt?: string;
};

/**
 * Interactive 1–5 star rating component.
 * Filled stars up to the current value, outline for the rest.
 */
export function RecipeRating({
  value,
  onRate,
  prompt = 'How would you rate this recipe?',
}: RecipeRatingProps) {
  const [hoveredStar, setHoveredStar] = useState(0);
  const [foregroundColor, mutedColor, warningColor, surfaceSecondaryColor] =
    useThemeColor([
      'foreground',
      'muted',
      'warning',
      'surface-secondary',
    ] as const);

  const displayValue = hoveredStar || value;

  return (
    <View
      style={[styles.container, { backgroundColor: surfaceSecondaryColor }]}
    >
      <Text style={[styles.prompt, { color: mutedColor }]}>{prompt}</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            hitSlop={4}
            onPress={() => onRate?.(star)}
          >
            <Ionicons
              name={star <= displayValue ? 'star' : 'star-outline'}
              size={32}
              color={star <= displayValue ? warningColor : mutedColor}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Liked indicator (heart) — shown near the title area
// ---------------------------------------------------------------------------

type RecipeLikedProps = {
  liked: boolean;
  onToggle?: () => void;
};

export function RecipeLikedButton({ liked, onToggle }: RecipeLikedProps) {
  const [dangerColor, mutedColor] = useThemeColor([
    'danger',
    'muted',
  ] as const);

  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <Ionicons
        name={liked ? 'heart' : 'heart-outline'}
        size={24}
        color={liked ? dangerColor : mutedColor}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 12,
  },
  prompt: {
    fontSize: 15,
    fontWeight: '500',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
