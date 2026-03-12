import { Chip } from 'heroui-native';
import React from 'react';
import { ScrollView } from 'react-native';

import { styles } from '@/styles/recipe-card.styles';

type RecipeCardCategoriesProps = {
  recipeId: string;
  categories?: string[];
  chipBackground: string;
  chipBorder: string;
};

export function RecipeCardCategories({
  recipeId,
  categories,
  chipBackground,
  chipBorder,
}: RecipeCardCategoriesProps) {
  if ((categories?.length ?? 0) === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
      {(categories ?? []).map((category) => (
        <Chip
          key={`${recipeId}-${category}`}
          size="sm"
          variant="tertiary"
          color="default"
          animation="disable-all"
          className="shrink-0 border"
          style={{ backgroundColor: chipBackground, borderColor: chipBorder }}
        >
          <Chip.Label className="text-xs">{category}</Chip.Label>
        </Chip>
      ))}
    </ScrollView>
  );
}
