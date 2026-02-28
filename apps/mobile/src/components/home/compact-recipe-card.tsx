import { Image } from 'expo-image';
import { useThemeColor } from 'heroui-native';
import React from 'react';
import { Text, View } from 'react-native';

import type { MobileRecipeCardItem } from '@/lib/recipes/recipe-card.types';

import { styles } from './compact-recipe-card.styles';

type CompactRecipeCardProps = {
  recipe: MobileRecipeCardItem;
  secondaryLabel?: 'duration' | 'course';
};

function formatDuration(totalDurationMinutes: number): string {
  if (totalDurationMinutes < 60) {
    return `${totalDurationMinutes}m`;
  }
  const hours = Math.floor(totalDurationMinutes / 60);
  const minutes = totalDurationMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function CompactRecipeCard({ recipe, secondaryLabel = 'duration' }: CompactRecipeCardProps) {
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
    <View style={[styles.card, { backgroundColor }]}>
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
    </View>
  );
}
