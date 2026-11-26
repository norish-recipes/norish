import React from "react";
import { EmptyCard } from "@/components/empty-card";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

/** Nothing in the Library yet: the first recipe comes from a link, text or photos. */
export function LibraryEmpty() {
  const intl = useIntl();

  return (
    <EmptyCard
      icon="book-outline"
      placement="screen"
      testID="library-empty"
      title={intl.formatMessage({ id: "recipes.empty.title" })}
    />
  );
}

/** A cookbook with no recipe in it. */
export function CookbookNoRecipes() {
  const intl = useIntl();

  return (
    <EmptyCard
      icon="book-outline"
      placement="screen"
      testID="cookbook-empty"
      title={intl.formatMessage({ id: "recipes.cookbooks.empty" })}
    />
  );
}

/** The Cookbooks lens with no cookbook: the way to make the first one. */
export function CookbooksEmpty() {
  const intl = useIntl();
  const router = useRouter();

  return (
    <EmptyCard
      action={{
        label: intl.formatMessage({ id: "recipes.cookbooks.createTitle" }),
        icon: "add",
        testID: "library-cookbooks-empty-new",
        onPress: () => router.push(TAB_ROUTES.recipes.newCookbook),
      }}
      icon="book-outline"
      placement="screen"
      testID="library-cookbooks-empty"
      title={intl.formatMessage({ id: "recipes.empty.noCookbooks" })}
    />
  );
}

/** Filters left nothing to show; Clear filters undoes them. */
export function LibraryNoResults({ onClear }: { onClear: () => void }) {
  const intl = useIntl();

  return (
    <EmptyCard
      action={{
        label: intl.formatMessage({ id: "common.filters.clearFilters" }),
        icon: "refresh",
        testID: "library-clear-filters",
        onPress: onClear,
      }}
      icon="funnel-outline"
      placement="screen"
      testID="library-no-results"
      title={intl.formatMessage({ id: "recipes.empty.noResults" })}
    />
  );
}
