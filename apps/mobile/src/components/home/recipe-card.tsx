import { Card, useThemeColor } from 'heroui-native';
import React from 'react';
import { Text } from 'react-native';

import type { RecipeCardItem } from '@/lib/recipes/recipe-card.types';

import { RecipeCardCategories } from './recipe-card-categories';
import { RecipeCardImage } from './recipe-card-image';
import { RecipeCardMetrics } from './recipe-card-metrics';

import { styles } from '@/styles/recipe-card.styles';

type RecipeCardProps = {
  recipe: RecipeCardItem;
};

function RecipeCardComponent({ recipe }: RecipeCardProps) {
  const [surfaceTertiary, separator, likedColor] = useThemeColor([
    'surface-tertiary',
    'separator',
    'danger-soft',
  ] as const);

  return (
    <Card variant="secondary" className="overflow-hidden rounded-2xl p-0">
      <RecipeCardImage recipe={recipe} likedColor={likedColor} />

      <Card.Body className="gap-1.5 px-3.5 pb-3.5 pt-3">
        <Text style={styles.title} className="text-foreground" numberOfLines={1}>
          {recipe.title}
        </Text>

        <RecipeCardCategories
          recipeId={recipe.id}
          categories={recipe.categories}
          chipBackground={surfaceTertiary}
          chipBorder={separator}
        />

        {recipe.description ? (
          <Text style={styles.description} className="text-foreground/70" numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}

        <RecipeCardMetrics recipe={recipe} />
      </Card.Body>
    </Card>
  );
}

export const RecipeCard = React.memo(RecipeCardComponent);
