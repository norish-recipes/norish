import React from "react";
import { NoResultsCard } from "@/components/no-results-card";
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
  const className = "bg-surface mx-5 mt-4";

  if (variant === "plain") {
    return (
      <NoResultsCard
        className={className}
        icon="search-outline"
        testID="search-no-results"
        title={intl.formatMessage({ id: "recipes.search.noMatch" }, { text })}
      />
    );
  }

  const clearing = variant === "clear-filters";

  return (
    <NoResultsCard
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
      description={clearing ? intl.formatMessage({ id: "recipes.empty.noResultsHint" }) : undefined}
      icon={clearing ? "funnel-outline" : "search-outline"}
      testID="search-no-results"
    />
  );
}
