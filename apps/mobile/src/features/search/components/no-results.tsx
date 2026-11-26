import React from "react";
import { EmptyCard } from "@/components/empty-card";
import { useIntl } from "react-intl";

import type { NoResults } from "../utils/search-state";

/** Nothing matched: loosen the filters, widen the Search Scope, or say so; each variant's card is
 * `noResultsVariant`'s. */
export function SearchNoResults({
  variant,
  text,
  onClearFilters,
  onSearchAllFields,
}: {
  variant: NoResults;
  text: string;
  onClearFilters: () => void;
  onSearchAllFields: () => void;
}) {
  const intl = useIntl();
  const className = "mx-5 mt-4";

  if (variant === "plain") {
    return (
      <EmptyCard
        className={className}
        icon="search-outline"
        testID="search-no-results"
        title={intl.formatMessage({ id: "recipes.search.noMatch" }, { text })}
      />
    );
  }

  const clearing = variant === "clear-filters";

  return (
    <EmptyCard
      action={
        clearing
          ? {
              label: intl.formatMessage({ id: "common.filters.clearFilters" }),
              icon: "refresh",
              testID: "search-clear-filters",
              onPress: onClearFilters,
            }
          : {
              label: intl.formatMessage({ id: "recipes.search.searchAllFields" }),
              icon: "search",
              testID: "search-all-fields",
              onPress: onSearchAllFields,
            }
      }
      className={className}
      icon={clearing ? "funnel-outline" : "search-outline"}
      testID="search-no-results"
      title={intl.formatMessage({ id: "recipes.empty.noResults" })}
    />
  );
}

/** The card in Results' place when Offline holds nothing for the search. */
export function SearchOffline() {
  const intl = useIntl();

  return (
    <EmptyCard
      className="mx-5 mt-4"
      icon="cloud-offline-outline"
      testID="search-offline"
      title={intl.formatMessage({ id: "recipes.search.offline" })}
    />
  );
}

/** The card in Results' place when a Live read failed and nothing is held: not "no results". */
export function SearchFailed() {
  const intl = useIntl();

  return (
    <EmptyCard
      className="mx-5 mt-4"
      icon="alert-circle-outline"
      testID="search-failed"
      title={intl.formatMessage({ id: "common.errorPage.title" })}
    />
  );
}
