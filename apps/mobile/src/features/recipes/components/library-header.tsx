import type { HeaderItem } from "@/lib/header-item";
import React, { useState } from "react";
import { View } from "react-native";
import { GlassIconButton } from "@/components/glass";
import { GlassSegmented } from "@/components/glass-segmented";
import { RollingText } from "@/components/rolling-text";
import { lightImpact } from "@/lib/haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { useLibraryFilters } from "@norish/shared-react/recipes";
import { LIBRARY_TYPE_FILTERS } from "@norish/shared/contracts";
import { hasAppliedRecipeFilters } from "@norish/shared/contracts/filter-contract";

import { useLibraryView } from "../hooks/use-library-view";

const HEADING_KEYS = {
  all: "recipes.dashboard.libraryTitle",
  recipes: "recipes.dashboard.recipesTitle",
  cookbooks: "recipes.dashboard.cookbooksTitle",
} as const satisfies Record<LibraryTypeFilter, string>;

const VIEWS = [
  { mode: "grid", icon: "grid-outline", label: "recipes.dashboard.viewMode.grid" },
  { mode: "list", icon: "list-outline", label: "recipes.dashboard.viewMode.list" },
] as const satisfies readonly { mode: RecipeViewMode; icon: string; label: string }[];

/** The grid or list switch, the reader's own choice on this device. */
export function ViewToggle() {
  const intl = useIntl();
  const [view, setView] = useLibraryView();

  return (
    <GlassSegmented
      iconOnly
      segments={VIEWS.map(({ mode, icon, label }) => ({
        value: mode,
        label: intl.formatMessage({ id: label }),
        icon: (color) => <Ionicons color={color} name={icon} size={20} />,
        testID: `library-view-${mode}`,
      }))}
      testID="library-view-toggle"
      value={view}
      onChange={(mode) => {
        if (mode !== view) lightImpact();
        setView(mode);
      }}
    />
  );
}

/** The Filters button, marked while any filter is on. */
export function FiltersButton() {
  const intl = useIntl();
  const router = useRouter();
  const filtersOn = hasAppliedRecipeFilters(useLibraryFilters((state) => state.filters));

  return (
    <View>
      <GlassIconButton
        label={intl.formatMessage({ id: "common.filters.title" })}
        symbol="line.3.horizontal.decrease"
        testID="library-filters-button"
        onPress={() => router.push("/filters")}
      />
      {filtersOn ? (
        <View
          className="bg-accent absolute top-1 right-1 size-2 rounded-full"
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

/** The Library's heading word, rolling to the lens's word the way the lens moved in LIBRARY_TYPE_FILTERS. */
function LibraryHeading({ type }: { type: LibraryTypeFilter }) {
  const intl = useIntl();
  const index = LIBRARY_TYPE_FILTERS.indexOf(type);
  const [shown, setShown] = useState({ index, rising: true });

  if (shown.index !== index) setShown({ index, rising: index > shown.index });

  return (
    <View testID="library-heading">
      <RollingText
        className="text-foreground text-2xl font-semibold"
        growth="end"
        rising={shown.rising}
        value={intl.formatMessage({ id: HEADING_KEYS[type] })}
      />
    </View>
  );
}

/**
 * The Library's heading and its grid or list toggle, the lenses and the Filters button. `scoped`,
 * for a cookbook's page, keeps only the toggle and Filters, at the page's right.
 */
export function LibraryHeader({ scoped = false }: { scoped?: boolean }) {
  const intl = useIntl();
  const filters = useLibraryFilters((state) => state.filters);
  const setFilters = useLibraryFilters((state) => state.setFilters);

  if (scoped) {
    return (
      <View className="flex-row items-center justify-end gap-2 px-5 pt-[18px] pb-3.5">
        <ViewToggle />
        <FiltersButton />
      </View>
    );
  }

  return (
    <View className="gap-3.5 pt-7 pb-4">
      <View className="flex-row items-center justify-between px-5">
        <LibraryHeading type={filters.libraryType} />
        <ViewToggle />
      </View>
      <View className="px-5">
        <GlassSegmented
          segments={LIBRARY_TYPE_FILTERS.map((type) => ({
            value: type,
            label: intl.formatMessage({ id: `recipes.dashboard.libraryType.${type}` }),
            testID: `library-lens-${type}`,
          }))}
          testID="library-lenses"
          value={filters.libraryType}
          onChange={(type) => {
            if (type !== filters.libraryType) lightImpact();
            setFilters({ libraryType: type });
          }}
        />
      </View>
    </View>
  );
}

/** Filters as a native bar item, marked while any filter is on. */
export function useFiltersItem(): HeaderItem {
  const intl = useIntl();
  const router = useRouter();
  const filtersOn = hasAppliedRecipeFilters(useLibraryFilters((state) => state.filters));
  const label = intl.formatMessage({ id: "common.filters.title" });

  return {
    type: "button",
    label,
    accessibilityLabel: label,
    identifier: "library-filters-button",
    icon: { type: "sfSymbol", name: "line.3.horizontal.decrease" },
    selected: filtersOn,
    onPress: () => router.push("/filters"),
  };
}
