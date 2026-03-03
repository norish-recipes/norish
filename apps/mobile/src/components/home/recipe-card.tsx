import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Card, Chip, useThemeColor } from 'heroui-native';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { RecipeCardItem } from '@/lib/recipes/recipe-card.types';

import { styles } from '@/styles/recipe-card.styles';

function ratingColor(rating: number, accent: string, warning: string, danger: string): string {
  if (rating <= 1) return danger;
  if (rating <= 3) return warning;
  return accent;
}

type RecipeCardProps = {
  recipe: RecipeCardItem;
};

function formatDuration(totalDurationMinutes: number) {
  if (totalDurationMinutes < 60) {
    return `${totalDurationMinutes}m`;
  }
  const hours = Math.floor(totalDurationMinutes / 60);
  const minutes = totalDurationMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function HighlightItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.highlightItem}>
      <Text style={styles.highlightLabel} className="text-foreground/70">
        {label}
      </Text>
      <Text style={styles.highlightValue} className="text-foreground">
        {value}
      </Text>
    </View>
  );
}

function RatingHighlight({
  rating,
  starColor,
}: {
  rating: number;
  starColor: string;
}) {
  return (
    <View style={styles.highlightItem}>
      <Text style={styles.highlightLabel} className="text-foreground/70">
        Rating
      </Text>
      <View style={styles.ratingRow}>
        <Text style={[styles.highlightValue, { color: starColor }]}>★</Text>
        <Text style={styles.highlightValue} className="text-foreground">
          {' '}
          {rating.toFixed(1)}
        </Text>
      </View>
    </View>
  );
}

function RecipeCardComponent({ recipe }: RecipeCardProps) {
  const [accent, warning, danger, divider] = useThemeColor([
    'accent',
    'warning',
    'danger',
    'border-secondary',
  ] as const);

  const tags = recipe.tags ?? [];

  return (
    <Card variant="secondary" className="overflow-hidden rounded-2xl p-0">
      <View className="relative w-full overflow-hidden bg-black" style={styles.imageContainer}>
        <Image
          source={{ uri: recipe.imageUrl }}
          contentFit="cover"
          transition={300}
          style={styles.imageFill}
        />

        {recipe.liked ? (
          <View className="absolute left-2.5 top-2.5">
            <BlurView intensity={60} tint="dark" style={styles.heartPill}>
              <Ionicons name="heart" size={13} color="#f4687a" />
            </BlurView>
          </View>
        ) : null}

        {tags.length > 0 ? (
          <View className="absolute inset-x-0 bottom-0 pb-2.5" pointerEvents="box-none">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagRow}
            >
              {tags.map((chip) => (
                <Chip
                  key={`${recipe.id}-${chip}`}
                  size="sm"
                  variant="soft"
                  color="default"
                  animation="disable-all"
                  className="shrink-0 bg-black/40 backdrop-blur-md"
                >
                  <Chip.Label className="text-white text-xs">{chip}</Chip.Label>
                </Chip>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <Card.Body className="gap-1.5 px-3.5 pb-3.5 pt-3">
        <View className="flex-row items-center gap-2">
          <Text style={styles.title} className="flex-1 text-foreground" numberOfLines={1}>
            {recipe.title}
          </Text>
          {recipe.course ? (
            <Chip
              size="sm"
              variant="secondary"
              color="default"
              animation="disable-all"
              className="shrink-0"
            >
              <Chip.Label className="text-xs">{recipe.course}</Chip.Label>
            </Chip>
          ) : null}
        </View>

        {recipe.description ? (
          <Text style={styles.description} className="text-foreground/70" numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}

        <View className="mt-1 flex-row items-center gap-3">
          {recipe.rating > 0 && (
            <>
              <RatingHighlight
                rating={recipe.rating}
                starColor={ratingColor(recipe.rating, accent, warning, danger)}
              />
              <View style={[styles.highlightDivider, { backgroundColor: divider }]} />
            </>
          )}
          <HighlightItem label="Servings" value={String(recipe.servings)} />
          <View style={[styles.highlightDivider, { backgroundColor: divider }]} />
          <HighlightItem label="Time" value={formatDuration(recipe.totalDurationMinutes)} />
        </View>
      </Card.Body>
    </Card>
  );
}

export const RecipeCard = React.memo(RecipeCardComponent);
