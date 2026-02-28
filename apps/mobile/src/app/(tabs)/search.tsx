import { Card, SearchField, useThemeColor } from 'heroui-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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

function SearchListItem({
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

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [backgroundColor, textColor] = useThemeColor(['background', 'foreground']);
  const recipes = useMemo(() => MOBILE_HOME_RECIPE_CARDS, []);

  const filteredRecipes = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return recipes;
    }

    return recipes.filter((recipe) => {
      return (
        recipe.title.toLowerCase().includes(normalized) ||
        recipe.description.toLowerCase().includes(normalized) ||
        recipe.tags.some((tag) => tag.toLowerCase().includes(normalized))
      );
    });
  }, [query, recipes]);

  const handleDelete = useCallback((id: string) => {
    console.log('[SearchScreen] delete recipe', id);
  }, []);

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
            title="Search"
            subtitle="Find recipes by name, ingredient, or style."
          />
          <SearchField value={query} onChange={setQuery}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder="Search recipes"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Text style={[styles.subheading, { color: textColor }]}>Results</Text>
        </View>

        {filteredRecipes.length === 0 ? (
          <Card variant="secondary" className="rounded-2xl border border-dashed border-separator">
            <Card.Body style={styles.emptyBody}>
              <Card.Title style={styles.emptyTitle}>No recipes found</Card.Title>
              <Card.Description style={styles.emptyDescription}>
                Try a different ingredient, cuisine, or keyword.
              </Card.Description>
            </Card.Body>
          </Card>
        ) : (
          filteredRecipes.map((item, index) => (
            <View key={item.id} style={index > 0 ? { marginTop: 8 } : undefined}>
              <SearchListItem item={item} onDelete={handleDelete} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
