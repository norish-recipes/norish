import React from "react";
import { Pressable, Text } from "react-native";
import { EmptyCard } from "@/components/empty-card";
import { useWarningInkColor } from "@/hooks/use-warning-ink-color";
import Ionicons from "@expo/vector-icons/Ionicons";
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
  const warningInk = useWarningInkColor();

  if (variant === "plain") {
    return (
      <EmptyCard
        className="bg-surface mx-5 mt-4"
        icon="search-outline"
        testID="search-no-results"
        title={intl.formatMessage({ id: "recipes.search.noMatch" }, { text })}
        tone="warning"
      />
    );
  }

  const clearing = variant === "clear-filters";

  return (
    <EmptyCard
      className="bg-surface mx-5 mt-4"
      description={clearing ? intl.formatMessage({ id: "recipes.empty.noResultsHint" }) : undefined}
      icon={clearing ? "funnel-outline" : "search-outline"}
      testID="search-no-results"
      title={intl.formatMessage({ id: "recipes.empty.noResults" })}
      tone="warning"
    >
      <Pressable
        accessibilityRole="button"
        className="bg-warning/20 h-11 flex-row items-center justify-center gap-2 rounded-full"
        testID={clearing ? "search-clear-filters" : "search-all-fields"}
        onPress={clearing ? onClearFilters : onSearchAllFields}
      >
        <Ionicons color={warningInk} name={clearing ? "refresh" : "search"} size={18} />
        <Text className="text-warning-ink text-[15px] font-medium">
          {intl.formatMessage({
            id: clearing ? "common.filters.clearFilters" : "recipes.search.searchAllFields",
          })}
        </Text>
      </Pressable>
    </EmptyCard>
  );
}
