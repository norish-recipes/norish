import type { RecipeListRow } from "@/lib/recipes/build-recipe-list-rows";
import type { NativeSyntheticEvent, TextInputFocusEventData } from "react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { RecipeEmptyStateCard } from "@/components/recipes/recipe-empty-state-card";
import { RecipeListRowContent } from "@/components/recipes/recipe-list-row-content";
import {
  recipeListScreenStyles,
  RowSeparator,
} from "@/components/recipes/recipe-list-screen.styles";
import { FilterChipRow } from "@/components/search/filter-chip-row";
import { FilterSheet } from "@/components/search/filter-sheet";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipeFiltersContext } from "@/context/recipe-filters-context";
import { useRecipesContext } from "@/context/recipes-context";
import { useRecipePrefetch } from "@/hooks/recipes/use-recipe-prefetch";
import { useViewableItemsRef, viewabilityConfig } from "@/hooks/recipes/use-viewability-config";
import { canShowDeleteAction } from "@/lib/permissions/mobile-action-visibility";
import { buildRecipeListRows } from "@/lib/recipes/build-recipe-list-rows";
import { createNextDeletingIds } from "@/lib/recipes/create-next-deleting-ids";
import { createRefreshRequestHandler } from "@/lib/refresh/create-refresh-request-handler";
import { styles } from "@/styles/index.styles";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { hasAppliedRecipeFilters } from "@norish/shared-react/contexts";

export default function SearchScreen() {
  const intl = useIntl();
  const { filters, setFilters } = useRecipeFiltersContext();
  const {
    recipeCards,
    isLoading,
    isValidating,
    error,
    pendingRecipeIds,
    openRecipe,
    deleteRecipe,
    toggleFavorite,
    invalidate,
  } = useRecipesContext();

  const { onViewableItemsChanged } = useRecipePrefetch();
  const viewableItemsRef = useViewableItemsRef(onViewableItemsChanged);
  const { canDeleteRecipe, isLoading: isLoadingPermissions } = usePermissionsContext();
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accentColor, foregroundColor] = useThemeColor(["accent", "foreground"] as const);

  const recipeCardsRef = useRef(recipeCards);
  recipeCardsRef.current = recipeCards;

  const listRows = useMemo<RecipeListRow[]>(() => {
    return buildRecipeListRows({
      recipes: recipeCards,
      isLoading,
      isValidating,
      pendingCount: pendingRecipeIds.size,
      recipePrefix: "search-recipe",
      initialSkeletonPrefix: "search-skeleton",
      pendingImportPrefix: "search-pending-import",
    });
  }, [isLoading, isValidating, recipeCards, pendingRecipeIds.size]);

  const hasActiveFilters = hasAppliedRecipeFilters(filters);

  const handleChangeText = useCallback(
    (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setFilters({ rawInput: event.nativeEvent.text });
    },
    [setFilters]
  );

  const handleOpenFilterSheet = useCallback(() => {
    setIsFilterSheetOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setDeletingIds((prev) => createNextDeletingIds(prev, id));
      deleteRecipe(id, recipeCardsRef.current.find((recipe) => recipe.id === id)?.version ?? 1);
    },
    [deleteRecipe]
  );

  const canDeleteOwnerRecipe = useCallback(
    (ownerId: string | null) => {
      return canShowDeleteAction({
        ownerId,
        isLoadingPermissions,
        canDeleteRecipe,
      });
    },
    [canDeleteRecipe, isLoadingPermissions]
  );

  const runRefresh = useMemo(
    () => createRefreshRequestHandler(async () => invalidate()),
    [invalidate]
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

    void runRefresh()
      .catch(() => {})
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [runRefresh]);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      toggleFavorite(id);
    },
    [toggleFavorite]
  );

  const renderRow = useCallback(
    ({ item }: { item: RecipeListRow }) => {
      const recipe = item.type === "recipe" ? item.recipe : null;
      return (
        <View style={recipeListScreenStyles.rowContainer}>
          <RecipeListRowContent
            row={item}
            onDelete={handleDelete}
            onPress={openRecipe}
            onToggleFavorite={handleToggleFavorite}
            isDeleting={recipe !== null && deletingIds.has(recipe.id)}
            canDelete={recipe !== null && canDeleteOwnerRecipe(recipe.ownerId)}
            compactPlaceholder
          />
        </View>
      );
    },
    [canDeleteOwnerRecipe, handleDelete, handleToggleFavorite, openRecipe, deletingIds]
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return null;
    }

    return (
      <View style={recipeListScreenStyles.searchEmptyTopSpacing}>
        <RecipeEmptyStateCard
          title={
            error
              ? intl.formatMessage({ id: "auth.errors.default.title" })
              : intl.formatMessage({ id: "recipes.empty.noResults" })
          }
          description={
            error
              ? intl.formatMessage({ id: "recipes.empty.noResultsHint" })
              : intl.formatMessage({ id: "recipes.empty.noResultsHint" })
          }
        />
      </View>
    );
  }, [error, intl, isLoading]);

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: intl.formatMessage({ id: "recipes.dashboard.searchRecipesPlaceholder" }),
            autoCapitalize: "none",
            onChangeText: handleChangeText,
          },
          headerRight: () => (
            <Pressable
              onPress={handleOpenFilterSheet}
              accessibilityRole="button"
              accessibilityLabel={intl.formatMessage({ id: "common.actions.filter" })}
              style={({ pressed }) => [
                recipeListScreenStyles.searchHeaderButton,
                pressed ? recipeListScreenStyles.searchHeaderButtonPressed : null,
              ]}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={hasActiveFilters ? accentColor : foregroundColor}
              />
              <Text
                style={{
                  ...recipeListScreenStyles.searchHeaderButtonLabel,
                  color: hasActiveFilters ? accentColor : foregroundColor,
                }}
              >
                {intl.formatMessage({ id: "common.filters.title" })}
              </Text>
            </Pressable>
          ),
        }}
      />

      <FlatList
        style={recipeListScreenStyles.list}
        data={listRows}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        ItemSeparatorComponent={RowSeparator}
        ListHeaderComponent={<FilterChipRow filters={filters} onFiltersChange={setFilters} />}
        ListEmptyComponent={renderEmpty}
        onViewableItemsChanged={viewableItemsRef.current}
        viewabilityConfig={viewabilityConfig}
        contentContainerStyle={[styles.listContent, recipeListScreenStyles.searchListInset]}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
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
