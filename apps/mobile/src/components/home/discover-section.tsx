import { PressableFeedback } from 'heroui-native';
import React from 'react';
import { ScrollView, View } from 'react-native';

import type { MobileRecipeCardItem } from '@/lib/recipes/recipe-card.types';
import { styles } from '@/styles/discover-section.styles';

import { CompactRecipeCard } from './compact-recipe-card';

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
          <PressableFeedback
            key={recipe.id}
            animation={false}
            onPress={() => console.log('[DiscoverSection] pressed recipe', recipe.id)}
            style={{ borderRadius: 12, overflow: 'hidden' }}
          >
            <PressableFeedback.Ripple />
            <CompactRecipeCard recipe={recipe} secondaryLabel="course" />
          </PressableFeedback>
        ))}
      </ScrollView>
    </View>
  );
}
