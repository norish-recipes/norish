import type { RecipeResultsProps, SearchHit } from "@/lib/recipe-results-props";
import React from "react";

import { LibraryCards } from "./library-cards";
import { RecipeCard } from "./recipe-card";

/** The fade over a results list under the bar. */
const FADE_HEIGHT = 120;

function hitOf(matches: RecipeResultsProps["matches"], id: string): SearchHit | undefined {
  const match = matches?.byId[id];

  return matches && match ? { match, search: matches.search } : undefined;
}

/** Recipes as the Library's cards, paged: the list Search shows its results in. */
export function RecipeResults({
  recipes,
  matches,
  header,
  isLoading,
  isFetchingNextPage,
  onEndReached,
  noResults,
  scroll,
  testID,
}: RecipeResultsProps) {
  return (
    <LibraryCards
      fadeHeight={FADE_HEIGHT}
      header={header}
      insets="automatic"
      isFetchingNextPage={isFetchingNextPage}
      isLoading={isLoading}
      noResults={noResults}
      renderCard={(recipe, { variant, actions, allergies, isFavorite }) => (
        <RecipeCard
          actions={actions}
          allergies={allergies}
          isFavorite={isFavorite(recipe.id)}
          hit={hitOf(matches, recipe.id)}
          recipe={recipe}
          variant={variant}
        />
      )}
      rowKey={(recipe) => recipe.id}
      rows={recipes}
      scroll={scroll}
      testID={testID}
      onEndReached={onEndReached}
    />
  );
}
