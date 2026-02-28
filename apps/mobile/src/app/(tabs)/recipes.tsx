import { Card, useThemeColor } from 'heroui-native';
import React, { useCallback, useMemo, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { styles } from '@/app/index.styles';
import { MobileRecipeCard } from '@/components/home/mobile-recipe-card';
import {
  SwipeableRecipeRow,
  type SwipeableRecipeRowRef,
} from '@/components/home/swipeable-recipe-row';
import { ShellHeader } from '@/components/shell/shell-header';
import type { MobileRecipeCardItem } from '@/lib/recipes/recipe-card.types';
import { MOBILE_HOME_RECIPE_CARDS } from '@/lib/recipes/recipe-mock-data';

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

export default function RecipesScreen() {
  const recipes = useMemo(() => MOBILE_HOME_RECIPE_CARDS, []);

  const [backgroundColor, textColor] = useThemeColor(['background', 'foreground']);

  const handleDelete = useCallback((id: string) => {
    console.log('[RecipesScreen] delete recipe', id);
  }, []);

  const renderRecipe = useCallback(
    ({ item }: { item: MobileRecipeCardItem }) => (
      <RecipeListItem item={item} onDelete={handleDelete} />
    ),
    [handleDelete],
  );

  return (
    <View collapsable={false} style={[styles.screen, { backgroundColor }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: 16,
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: 120,
          },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ShellHeader
            title="Recipes"
            subtitle="Pick up where you left off, or find something new to cook."
          />
          <Text style={[styles.subheading, { color: textColor }]}>Your collection</Text>
        </View>

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
      </ScrollView>
    </View>
  );
}
