import type { TabScroll } from "@/lib/use-tab-scroll";
import type { ReactElement } from "react";

import type { LibraryMatchDTO, RecipeDashboardDTO } from "@norish/shared/contracts";

/** Why one recipe matched, and the text searched for. */
export type SearchHit = { match: LibraryMatchDTO; search: string };

/** What the Library's card list takes to show a search's recipes, paged, under `header`: the route
 * file hands the list to Search, as a feature cannot import another's. */
export type RecipeResultsProps = {
  recipes: RecipeDashboardDTO[];
  /** Why each recipe matched, by id, for the text searched; the cards show it in place of their description. */
  matches?: { byId: Record<string, LibraryMatchDTO>; search: string };
  header: ReactElement;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  noResults: ReactElement;
  scroll: TabScroll;
  testID?: string;
};
