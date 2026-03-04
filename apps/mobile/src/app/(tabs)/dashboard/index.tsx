import { Card } from 'heroui-native';
import React, { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { styles } from '@/styles/index.styles';
import { RecipeCard } from '@/components/home/recipe-card';
import { SectionHeader } from '@/components/home/section-header';
import { TodaysMealsSection } from '@/components/home/todays-meals-section';
import {
  SwipeableRecipeRow,
  type SwipeableRecipeRowRef,
} from '@/components/home/swipeable-recipe-row';
import { useRecipesQuery } from '@/hooks/recipes';
import type { RecipeCardItem } from '@/lib/recipes/recipe-card.types';
import { TODAYS_MEALS_MOCK } from '@/lib/meals/planned-meal-mock-data';
import { useAuth } from '@/context/auth-context';

import type { RecipeDashboardDTO } from '@norish/shared/contracts';

function resolveRecipeImageUrl(image: string | null, backendBaseUrl: string | null): string {
  if (!image) return '';
  if (/^https?:\/\//i.test(image)) return image;
  if (!backendBaseUrl) return image;

  return `${backendBaseUrl.replace(/\/+$/, '')}/${image.replace(/^\/+/, '')}`;
}

function mapDashboardRecipeToCardItem(
  recipe: RecipeDashboardDTO,
  backendBaseUrl: string | null,
  authCookie: string | null,
): RecipeCardItem {
  return {
    id: recipe.id,
    imageUrl: resolveRecipeImageUrl(recipe.image, backendBaseUrl),
    imageHeaders: authCookie ? { Cookie: authCookie } : undefined,
    title: recipe.name,
    description: recipe.description ?? '',
    servings: recipe.servings,
    rating: Math.max(0, Math.min(5, Math.round(recipe.averageRating ?? 0))),
    tags: (recipe.tags ?? []).map((tag) =>
      typeof tag === 'string' ? tag : tag.name
    ),
    categories: recipe.categories?.slice(0, 4),
    course: recipe.categories?.[0] ?? '',
    liked: false,
    totalDurationMinutes: recipe.totalMinutes ?? 0,
  };
}

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
  const { backendBaseUrl, authClient } = useAuth();
  const { recipes, isLoading, error, hasMore, isValidating, loadMore } = useRecipesQuery({
    limit: 20,
  });
  const authCookie = ((authClient as any)?.getCookie?.() as string | undefined) ?? null;
  const recipeCards = useMemo(
    () => recipes.map((recipe) => mapDashboardRecipeToCardItem(recipe, backendBaseUrl, authCookie)),
    [recipes, backendBaseUrl, authCookie],
  );

  const router = useRouter();

  const handleDelete = useCallback((id: string) => {
    console.log('[RecipesScreen] delete recipe', id);
  }, []);

  const renderRecipe = useCallback(
    ({ item }: { item: RecipeCardItem }) => (
      <View style={{ paddingHorizontal: 16 }}>
        <RecipeListItem item={item} onDelete={handleDelete} />
      </View>
    ),
    [handleDelete],
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
          title="Today"
          actionLabel="Calendar"
          onAction={() => router.push('/(tabs)/calendar')}
        />
        <TodaysMealsSection meals={TODAYS_MEALS_MOCK} />
        <SectionHeader title="Your Collection" />
      </>
    ),
    [router],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={{ paddingHorizontal: 16 }}>
          <Card variant="secondary" className="rounded-2xl border border-separator">
            <Card.Body style={styles.emptyBody}>
              <Text style={styles.emptyTitle}>Loading recipes...</Text>
            </Card.Body>
          </Card>
        </View>
      );
    }

    if (error) {
      return (
        <View style={{ paddingHorizontal: 16 }}>
          <Card variant="secondary" className="rounded-2xl border border-separator">
            <Card.Body style={styles.emptyBody}>
              <Text style={styles.emptyTitle}>Could not load recipes</Text>
              <Text style={styles.emptyDescription}>Pull to refresh or try again in a moment.</Text>
            </Card.Body>
          </Card>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 16 }}>
        <Card variant="secondary" className="rounded-2xl border border-dashed border-separator">
          <Card.Body style={styles.emptyBody}>
            <Card.Title style={styles.emptyTitle}>No recipes yet</Card.Title>
            <Card.Description style={styles.emptyDescription}>
              Add your first recipe to start building your home feed.
            </Card.Description>
          </Card.Body>
        </Card>
      </View>
    );
  }, [error, isLoading]);

  const renderFooter = useCallback(() => {
    if (!isValidating || !recipeCards.length) return null;

    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }, [isValidating, recipeCards.length]);

  return (
    <FlatList
      style={{ flex: 1 }}
      data={recipeCards}
      keyExtractor={(item) => item.id}
      renderItem={renderRecipe}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.6}
      contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustsScrollIndicatorInsets
      showsVerticalScrollIndicator={false}
    />
  );
}
