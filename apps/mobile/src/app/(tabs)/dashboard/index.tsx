import type { RecipeListRow } from "@/lib/recipes/build-recipe-list-rows";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { SectionHeader } from "@/components/home/section-header";
import { TodaysMealsSection } from "@/components/home/todays-meals-section";
import { RecipeEmptyStateCard } from "@/components/recipes/recipe-empty-state-card";
import { RecipeListRowContent } from "@/components/recipes/recipe-list-row-content";
import {
  recipeListScreenStyles,
  RowSeparator,
} from "@/components/recipes/recipe-list-screen.styles";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";
import { useRecipePrefetch } from "@/hooks/recipes/use-recipe-prefetch";
import { useViewableItemsRef, viewabilityConfig } from "@/hooks/recipes/use-viewability-config";
import { TODAYS_MEALS_MOCK } from "@/lib/meals/planned-meal-mock-data";
import { canShowDeleteAction } from "@/lib/permissions/mobile-action-visibility";
import { buildRecipeListRows } from "@/lib/recipes/build-recipe-list-rows";
import { createNextDeletingIds } from "@/lib/recipes/create-next-deleting-ids";
import { createRefreshRequestHandler } from "@/lib/refresh/create-refresh-request-handler";
import { styles } from "@/styles/index.styles";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

export default function RecipesScreen() {
  const router = useRouter();
  const intl = useIntl();
  const {
    recipeCards,
    isLoading,
    error,
    hasMore,
    isValidating,
    loadMore,
    pendingRecipeIds,
    openRecipe,
    deleteRecipe,
    toggleFavorite,
    invalidate,
  } = useRecipesContext();

  const { onViewableItemsChanged } = useRecipePrefetch();
  const viewableItemsRef = useViewableItemsRef(onViewableItemsChanged);
  const { canDeleteRecipe, isLoading: isLoadingPermissions } = usePermissionsContext();

  const [deletingIds, setDeletingIds] = useState<ReadonlySet<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const recipeCardsRef = useRef(recipeCards);
  recipeCardsRef.current = recipeCards;

  const listRows = useMemo<RecipeListRow[]>(() => {
    return buildRecipeListRows({
      recipes: recipeCards,
      isLoading,
      isValidating,
      pendingCount: pendingRecipeIds.size,
      recipePrefix: "dashboard-recipe",
      initialSkeletonPrefix: "initial-skeleton",
      pendingImportPrefix: "pending-import",
    });
  }, [isLoading, isValidating, recipeCards, pendingRecipeIds.size]);

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
          />
        </View>
      );
    },
    [canDeleteOwnerRecipe, handleDelete, handleToggleFavorite, openRecipe, deletingIds]
  );

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isValidating) {
      loadMore();
    }
  }, [hasMore, isValidating, loadMore]);

  const renderHeader = useCallback(
    () => (
      <>
        <SectionHeader
          title={intl.formatMessage({ id: "calendar.mobile.today" })}
          actionLabel={intl.formatMessage({ id: "calendar.page.title" })}
          onAction={() => router.push("/(tabs)/calendar")}
        />
        <TodaysMealsSection meals={TODAYS_MEALS_MOCK} />
        <SectionHeader title={intl.formatMessage({ id: "recipes.dashboard.title" })} />
      </>
    ),
    [intl, router]
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return null;
    }

    if (error) {
      return (
        <RecipeEmptyStateCard
          title={intl.formatMessage({ id: "auth.errors.default.title" })}
          description={intl.formatMessage({ id: "recipes.empty.noResultsHint" })}
          dashedBorder={false}
        />
      );
    }

    return (
      <RecipeEmptyStateCard
        title={intl.formatMessage({ id: "recipes.empty.noResults" })}
        description={intl.formatMessage({ id: "recipes.empty.noResultsHint" })}
      />
    );
  }, [error, intl, isLoading]);

  const renderFooter = useCallback(() => {
    if (!isValidating || !recipeCards.length) return null;

    return (
      <View style={recipeListScreenStyles.loadingFooter}>
        <ActivityIndicator />
      </View>
    );
  }, [isValidating, recipeCards.length]);

  return (
    <FlatList
      style={recipeListScreenStyles.list}
      data={listRows}
      keyExtractor={(item) => item.id}
      renderItem={renderRow}
      ItemSeparatorComponent={RowSeparator}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.6}
      onViewableItemsChanged={viewableItemsRef.current}
      viewabilityConfig={viewabilityConfig}
      contentContainerStyle={[styles.listContent, recipeListScreenStyles.dashboardListInset]}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustsScrollIndicatorInsets
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    />
  );
}
