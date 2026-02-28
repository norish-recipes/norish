import { PressableFeedback } from 'heroui-native';
import React from 'react';
import { ScrollView, View } from 'react-native';

import type { MobileRecipeCardItem } from '@/lib/recipes/recipe-card.types';

import { CompactRecipeCard } from './compact-recipe-card';
import { styles } from './continue-cooking-section.styles';

type ContinueCookingSectionProps = {
  recipes: MobileRecipeCardItem[];
};

export function ContinueCookingSection({ recipes }: ContinueCookingSectionProps) {
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
            onPress={() => console.log('[ContinueCookingSection] pressed recipe', recipe.id)}
            style={{ borderRadius: 12, overflow: 'hidden' }}
          >
            <PressableFeedback.Ripple />
            <CompactRecipeCard recipe={recipe} secondaryLabel="duration" />
          </PressableFeedback>
        ))}
      </ScrollView>
    </View>
  );
}
