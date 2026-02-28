import { Image } from 'expo-image';
import { PressableFeedback, useThemeColor } from 'heroui-native';
import React from 'react';
import { Text, View } from 'react-native';

import type { MobileRecipeCardItem } from '@/lib/recipes/recipe-card.types';

import { styles } from './compact-recipe-card.styles';

type CompactRecipeCardProps = {
  recipe: MobileRecipeCardItem;
  secondaryLabel?: 'duration' | 'course';
  onPress?: () => void;
};

function formatDuration(totalDurationMinutes: number): string {
  if (totalDurationMinutes < 60) {
    return `${totalDurationMinutes}m`;
  }
  const hours = Math.floor(totalDurationMinutes / 60);
  const minutes = totalDurationMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function CompactRecipeCard({ recipe, secondaryLabel = 'duration', onPress }: CompactRecipeCardProps) {
  const [backgroundColor, textColor, mutedColor] = useThemeColor([
    'surface',
    'foreground',
    'muted',
  ] as const);

  const subtitle =
    secondaryLabel === 'course'
      ? recipe.course
      : formatDuration(recipe.totalDurationMinutes);

  return (
    <PressableFeedback onPress={onPress} animation={false} style={[styles.card, { backgroundColor }]}>
      <PressableFeedback.Ripple />
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: recipe.imageUrl }}
          contentFit="cover"
          transition={300}
          style={styles.imageFill}
        />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
          {recipe.title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: mutedColor }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </PressableFeedback>
  );
}
