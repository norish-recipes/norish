import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Card, useThemeColor } from 'heroui-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { type NativeSyntheticEvent, type TextInputFocusEventData, Pressable, ScrollView, Text, View } from 'react-native';

import { styles } from '@/styles/index.styles';
import { RecipeCard } from '@/components/home/recipe-card';
import { FilterChipRow } from '@/components/search/filter-chip-row';
import { FilterSheet } from '@/components/search/filter-sheet';
import {
  SwipeableRecipeRow,
  type SwipeableRecipeRowRef,
} from '@/components/home/swipeable-recipe-row';
import type { RecipeCardItem } from '@/lib/recipes/recipe-card.types';
import { MOBILE_HOME_RECIPE_CARDS } from '@/lib/recipes/recipe-mock-data';
import type { SearchFilters } from '@/lib/recipes/search-filters';
import { DEFAULT_FILTERS, isFiltersEmpty } from '@/lib/recipes/search-filters';

function SearchListItem({
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

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [accentColor, foregroundColor] = useThemeColor([
    'accent',
    'foreground',
  ] as const);
  const recipes = useMemo(() => MOBILE_HOME_RECIPE_CARDS, []);

  const hasActiveFilters = !isFiltersEmpty(filters);

  const handleChangeText = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setQuery(e.nativeEvent.text);
    },
    [],
  );

  const handleOpenFilterSheet = useCallback(() => {
    setIsFilterSheetOpen(true);
  }, []);

  const filteredRecipes = useMemo(() => {
    if (typeof query !== 'string') return recipes;

    const normalized = (query ?? '').toString().trim().toLowerCase();

    return recipes.filter((recipe) => {
      // Text query filter
      if (normalized) {
        const matchesText =
          recipe.title.toLowerCase().includes(normalized) ||
          recipe.description.toLowerCase().includes(normalized) ||
          recipe.tags.some((tag) => tag.toLowerCase().includes(normalized));
        if (!matchesText) return false;
      }

      // Course filter
      if (filters.course !== null && recipe.course !== filters.course) {
        return false;
      }

      // Cooking time filter
      if (filters.maxCookingTime !== null && recipe.totalDurationMinutes > filters.maxCookingTime) {
        return false;
      }

      // Favorites filter
      if (filters.liked && !recipe.liked) {
        return false;
      }

      // Min rating filter
      if (filters.minRating !== null && recipe.rating < filters.minRating) {
        return false;
      }

      // Tags filter — recipe must include all selected tags
      if (filters.tags.size > 0) {
        const hasAllTags = [...filters.tags].every((tag) => recipe.tags.includes(tag));
        if (!hasAllTags) return false;
      }

      return true;
    });
  }, [query, recipes, filters]);

  const handleDelete = useCallback((id: string) => {
    console.log('[SearchScreen] delete recipe', id);
  }, []);

  return (
    <>
      {/* Declarative header options — wires search bar callback and filter button */}
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: 'Search recipes',
            autoCapitalize: 'none',
            onChangeText: handleChangeText,
          },
          headerRight: () => (
            <Pressable
              onPress={handleOpenFilterSheet}
              accessibilityRole="button"
              accessibilityLabel="Open filters"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                opacity: pressed ? 0.75 : 1,
                marginRight: 4,
              })}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={hasActiveFilters ? accentColor : foregroundColor}
              />
              <Text
                style={{
                  color: hasActiveFilters ? accentColor : foregroundColor,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                Filters
              </Text>
            </Pressable>
          ),
        }}
      />

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
        <FilterChipRow filters={filters} onFiltersChange={setFilters} />

        <View style={{ paddingTop: 16, paddingLeft: 16, paddingRight: 16 }}>
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
        </View>
      </ScrollView>

      <FilterSheet
        isOpen={isFilterSheetOpen}
        onOpenChange={setIsFilterSheetOpen}
        filters={filters}
        onApply={setFilters}
      />
    </>
  );
}
