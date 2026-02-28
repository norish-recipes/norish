import React from 'react';
import { ScrollView, View } from 'react-native';

import type { MobileRecipeCardItem } from '@/lib/recipes/recipe-card.types';

import { CompactRecipeCard } from './compact-recipe-card';
import { styles } from './discover-section.styles';

type DiscoverSectionProps = {
  recipes: MobileRecipeCardItem[];
};

export function DiscoverSection({ recipes }: DiscoverSectionProps) {
  return (
    <View style={styles.section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.scrollContent}
      >
        {recipes.map((recipe) => (
          <CompactRecipeCard key={recipe.id} recipe={recipe} secondaryLabel="course" />
        ))}
      </ScrollView>
    </View>
  );
}
