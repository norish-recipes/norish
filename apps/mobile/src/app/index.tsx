import { FlashList } from '@shopify/flash-list';
import { Card, useThemeColor } from 'heroui-native';
import React, { useCallback, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '@/app/index.styles';
import { MobileRecipeCard } from '@/features/home/components/mobile-recipe-card';
import {
  SwipeableRecipeRow,
  type SwipeableRecipeRowRef,
} from '@/features/home/components/swipeable-recipe-row';
import type { MobileRecipeCardItem } from '@/features/home/recipe-card.types';
import { MOBILE_HOME_RECIPE_CARDS } from '@/features/home/recipe-mock-data';

function RecipeListItem({
  item,
  onDelete,
}: {
  item: MobileRecipeCardItem;
  onDelete: (id: string) => void;
}) {
  const rowRef = useRef<SwipeableRecipeRowRef>(null);

  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [item.id, onDelete]);

  return (
    <SwipeableRecipeRow ref={rowRef} recipeName={item.title} onDelete={handleDelete}>
      <MobileRecipeCard recipe={item} />
    </SwipeableRecipeRow>
  );
}

export default function HomeScreen() {
  const recipes = useMemo(() => MOBILE_HOME_RECIPE_CARDS, []);
  const [backgroundColor, textColor] = useThemeColor(['background', 'foreground']);

  // In a real app this would dispatch to a store; for now just log.
  const handleDelete = useCallback((id: string) => {
    console.log('[HomeScreen] delete recipe', id);
  }, []);

  const renderRecipe = useCallback(
    ({ item }: { item: MobileRecipeCardItem }) => (
      <RecipeListItem item={item} onDelete={handleDelete} />
    ),
    [handleDelete],
  );

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlashList
          data={recipes}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={[styles.heading, { color: textColor }]}>
                Your recipes
              </Text>
              <Text style={[styles.subheading, { color: textColor }]}>
                Pick up where you left off, or find something new to cook.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Card variant="secondary" className="rounded-2xl border border-dashed border-separator">
              <Card.Body style={styles.emptyBody}>
                <Card.Title style={styles.emptyTitle}>No recipes yet</Card.Title>
                <Card.Description style={styles.emptyDescription}>
                  Add your first recipe to start building your home feed.
                </Card.Description>
              </Card.Body>
            </Card>
          }
        />
      </SafeAreaView>
    </View>
  );
}
