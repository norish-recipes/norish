import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
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

  if (variant === "plain") {
    return (
      <InResultsPlace>
        <EmptyCard
          icon="search-outline"
          placement="screen"
          testID="search-no-results"
          title={intl.formatMessage({ id: "recipes.search.noMatch" }, { text })}
        />
      </InResultsPlace>
    );
  }

  const clearing = variant === "clear-filters";

  return (
    <InResultsPlace>
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
        placement="screen"
        icon={clearing ? "funnel-outline" : "search-outline"}
        testID="search-no-results"
        title={intl.formatMessage({ id: "recipes.empty.noResults" })}
      />
    </InResultsPlace>
  );
}

/** The card in Results' place when Offline holds nothing for the search. */
export function SearchOffline() {
  const intl = useIntl();

  return (
    <InResultsPlace>
      <EmptyCard
        placement="screen"
        icon="cloud-offline-outline"
        testID="search-offline"
        title={intl.formatMessage({ id: "recipes.search.offline" })}
      />
    </InResultsPlace>
  );
}

/** The card in Results' place when a Live read failed and nothing is held: not "no results". */
export function SearchFailed() {
  const intl = useIntl();

  return (
    <InResultsPlace>
      <EmptyCard
        placement="screen"
        icon="alert-circle-outline"
        testID="search-failed"
        title={intl.formatMessage({ id: "common.errorPage.title" })}
      />
    </InResultsPlace>
  );
}

/** Where the results' count and cards begin, 16 pt under the chips. */
function InResultsPlace({ children }: { children: ReactNode }) {
  return <View className="pt-4">{children}</View>;
}
