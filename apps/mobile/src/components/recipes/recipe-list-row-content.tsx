import React from 'react';

import {
  ImportingRecipePlaceholder,
  RecipeCardSkeleton,
} from '@/components/skeletons/recipe-card-skeleton';
import { SwipeableRecipeListItem } from '@/components/recipes/swipeable-recipe-list-item';
import type { RecipeListRow } from '@/lib/recipes/build-recipe-list-rows';

type RecipeListRowContentProps = {
  row: RecipeListRow;
  onDelete: (id: string) => void;
  onPress: (id: string) => void;
  deletingIds: ReadonlySet<string>;
  canDeleteRecipe: (ownerId: string | null) => boolean;
  compactPlaceholder?: boolean;
};

export function RecipeListRowContent({
  row,
  onDelete,
  onPress,
  deletingIds,
  canDeleteRecipe,
  compactPlaceholder = false,
}: RecipeListRowContentProps) {
  if (row.type === 'initial-skeleton') {
    return <RecipeCardSkeleton compact={compactPlaceholder} />;
  }

  if (row.type === 'pending-import') {
    return <ImportingRecipePlaceholder compact={compactPlaceholder} />;
  }

  return (
    <SwipeableRecipeListItem
      item={row.recipe}
      onDelete={onDelete}
      onPress={onPress}
      isDeleting={deletingIds.has(row.recipe.id)}
      canDelete={canDeleteRecipe(row.recipe.ownerId)}
    />
  );
}
