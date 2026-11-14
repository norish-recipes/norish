import type { ReactElement } from "react";
import React from "react";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { useDevicePreference } from "@norish/shared-react/reader";
import { useLibraryCards, useLibraryFilters } from "@norish/shared-react/recipes";
import { hasAppliedRecipeFilters } from "@norish/shared/contracts/filter-contract";

import type { CardActions } from "../hooks/use-card-actions";
import { useCardActions } from "../hooks/use-card-actions";
import { CardList } from "./card-list";
import { LibrarySkeleton } from "./library-skeleton";
import { LibraryNoResults } from "./library-states";

/** What a card is drawn and acted on with. */
export type CardContext = {
  variant: RecipeViewMode;
  actions: CardActions;
  allergies: string[];
  isFavorite: (recipeId: string) => boolean;
};

/**
 * The Library's cards, the Recipes tab's and a cookbook page's: skeleton while loading, no results
 * with Clear filters once filters match nothing, else `empty`. `cookbook` is the one the cards are in.
 */
export function LibraryCards<Row>({
  rows,
  isLoading,
  isFetchingNextPage,
  header,
  empty,
  cookbook,
  rowKey,
  renderCard,
  onEndReached,
  fadeHeight,
  testID,
}: {
  rows: Row[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  header: ReactElement;
  /** What shows when nothing is loading, no filter is on and there is no row. */
  empty: ReactElement;
  cookbook?: CookbookSummaryDTO;
  rowKey: (row: Row) => string;
  renderCard: (row: Row, context: CardContext) => ReactElement;
  onEndReached: () => void;
  fadeHeight: { rest: number; scrolled: number };
  testID?: string;
}) {
  const [variant] = useDevicePreference("recipeViewMode");
  const filters = useLibraryFilters((state) => state.filters);
  const clearFilters = useLibraryFilters((state) => state.clearFilters);
  const { isFavorite, allergies } = useLibraryCards();
  const actions = useCardActions(cookbook);

  return (
    <CardList
      empty={
        isLoading ? (
          <LibrarySkeleton variant={variant} />
        ) : hasAppliedRecipeFilters(filters) ? (
          <LibraryNoResults onClear={clearFilters} />
        ) : (
          empty
        )
      }
      fadeHeight={fadeHeight}
      header={header}
      isFetchingNextPage={isFetchingNextPage}
      renderCard={(row) => renderCard(row, { variant, actions, allergies, isFavorite })}
      rowKey={rowKey}
      rows={isLoading ? [] : rows}
      testID={testID}
      variant={variant}
      onEndReached={onEndReached}
    />
  );
}
