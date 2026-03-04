import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useThemeColor } from 'heroui-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  Pressable,
  Text,
  View,
} from 'react-native';

import { RecipeEmptyStateCard } from '@/components/recipes/recipe-empty-state-card';
import { RecipeListRowContent } from '@/components/recipes/recipe-list-row-content';
import { FilterChipRow } from '@/components/search/filter-chip-row';
import { FilterSheet } from '@/components/search/filter-sheet';
import { useRecipeFiltersContext } from '@/context/recipe-filters-context';
import { useRecipesContext } from '@/context/recipes-context';
import { buildRecipeListRows, type RecipeListRow } from '@/lib/recipes/build-recipe-list-rows';
import { createNextDeletingIds } from '@/lib/recipes/create-next-deleting-ids';
import { styles } from '@/styles/index.styles';

import { hasAppliedRecipeFilters } from '@norish/shared-react/contexts';

export default function SearchScreen() {
  const { filters, setFilters } = useRecipeFiltersContext();
  const { recipeCards, isLoading, isValidating, error, pendingRecipeIds, openRecipe, deleteRecipe } =
    useRecipesContext();
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<string>>(new Set());
  const [accentColor, foregroundColor] = useThemeColor(['accent', 'foreground'] as const);

  const listRows = useMemo<RecipeListRow[]>(() => {
    return buildRecipeListRows({
      recipes: recipeCards,
      isLoading,
      isValidating,
      pendingCount: pendingRecipeIds.size,
      recipePrefix: 'search-recipe',
      initialSkeletonPrefix: 'search-skeleton',
      pendingImportPrefix: 'search-pending-import',
    });
  }, [isLoading, isValidating, recipeCards, pendingRecipeIds.size]);

  const hasActiveFilters = hasAppliedRecipeFilters(filters);

  const handleChangeText = useCallback(
    (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setFilters({ rawInput: event.nativeEvent.text });
    },
    [setFilters],
  );

  const handleOpenFilterSheet = useCallback(() => {
    setIsFilterSheetOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setDeletingIds((prev) => createNextDeletingIds(prev, id));
      deleteRecipe(id);
    },
    [deleteRecipe],
  );

  const renderRow = useCallback(
    ({ item }: { item: RecipeListRow }) => (
      <View style={{ paddingHorizontal: 16 }}>
        <RecipeListRowContent
          row={item}
          onDelete={handleDelete}
          onPress={openRecipe}
          deletingIds={deletingIds}
          compactPlaceholder
        />
      </View>
    ),
    [handleDelete, openRecipe, deletingIds],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return null;
    }

    return (
      <View style={{ paddingTop: 16 }}>
        <RecipeEmptyStateCard
          title={error ? 'Could not load recipes' : 'No recipes found'}
          description={
            error
              ? 'Pull to refresh or try again in a moment.'
              : 'Try a different ingredient, cuisine, or keyword.'
          }
        />
      </View>
    );
  }, [error, isLoading]);

  return (
    <>
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

      <FlatList
        style={{ flex: 1 }}
        data={listRows}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={<FilterChipRow filters={filters} onFiltersChange={setFilters} />}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        showsVerticalScrollIndicator={false}
      />

      <FilterSheet
        isOpen={isFilterSheetOpen}
        onOpenChange={setIsFilterSheetOpen}
        filters={filters}
        onApply={setFilters}
      />
    </>
  );
}
