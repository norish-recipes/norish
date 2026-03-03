import { Card } from 'heroui-native';
import React, { useCallback, useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { styles } from '@/styles/index.styles';
import { RecipeCard } from '@/components/home/recipe-card';
import { SectionHeader } from '@/components/home/section-header';
import { TodaysMealsSection } from '@/components/home/todays-meals-section';
import {
  SwipeableRecipeRow,
  type SwipeableRecipeRowRef,
} from '@/components/home/swipeable-recipe-row';
import type { RecipeCardItem } from '@/lib/recipes/recipe-card.types';
import { TODAYS_MEALS_MOCK } from '@/lib/meals/planned-meal-mock-data';
import { MOBILE_HOME_RECIPE_CARDS } from '@/lib/recipes/recipe-mock-data';

function RecipeListItem({
  item,
  onDelete,
}: {
  item: RecipeCardItem;
  onDelete: (id: string) => void;
}) {
  const rowRef = useRef<SwipeableRecipeRowRef>(null);

  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [item.id, onDelete]);

  return (
    <SwipeableRecipeRow ref={rowRef} recipeName={item.title} onDelete={handleDelete}>
      <RecipeCard recipe={item} />
    </SwipeableRecipeRow>
  );
}

export default function RecipesScreen() {
  const recipes = useMemo(() => MOBILE_HOME_RECIPE_CARDS, []);
  const router = useRouter();

  const handleDelete = useCallback((id: string) => {
    console.log('[RecipesScreen] delete recipe', id);
  }, []);

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCardItem }) => (
      <RecipeListItem item={item} onDelete={handleDelete} />
    ),
    [handleDelete],
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.listContent,
        {
          paddingBottom: 120,
        },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustsScrollIndicatorInsets
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        title="Today"
        actionLabel="Calendar"
        onAction={() => router.push('/(tabs)/calendar')}
      />
      <TodaysMealsSection meals={TODAYS_MEALS_MOCK} />

      <SectionHeader title="Your Collection" />

      <View style={{ paddingHorizontal: 16 }}>
        {recipes.length === 0 ? (
          <Card variant="secondary" className="rounded-2xl border border-dashed border-separator">
            <Card.Body style={styles.emptyBody}>
              <Card.Title style={styles.emptyTitle}>No recipes yet</Card.Title>
              <Card.Description style={styles.emptyDescription}>
                Add your first recipe to start building your home feed.
              </Card.Description>
            </Card.Body>
          </Card>
        ) : (
          recipes.map((item, index) => (
            <View key={item.id} style={index > 0 ? { marginTop: 8 } : undefined}>
              {renderRecipe({ item })}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
