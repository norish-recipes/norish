import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { useDevicePreference } from "@norish/shared-react/reader";
import { useLibraryFilters } from "@norish/shared-react/recipes";
import { LIBRARY_TYPE_FILTERS } from "@norish/shared/contracts";
import { hasAppliedRecipeFilters } from "@norish/shared/contracts/filter-contract";

const HEADING_KEYS = {
  all: "recipes.dashboard.libraryTitle",
  recipes: "recipes.dashboard.recipesTitle",
  cookbooks: "recipes.dashboard.cookbooksTitle",
} as const satisfies Record<LibraryTypeFilter, string>;

const VIEWS = [
  { mode: "grid", icon: "grid-outline", label: "recipes.dashboard.viewMode.grid" },
  { mode: "list", icon: "list-outline", label: "recipes.dashboard.viewMode.list" },
] as const satisfies readonly { mode: RecipeViewMode; icon: string; label: string }[];

/** The Library's heading and its grid or list toggle, the lenses and the Filters button. */
export function LibraryHeader() {
  const intl = useIntl();
  const router = useRouter();
  const [view, setView] = useDevicePreference("recipeViewMode");
  const [foreground, muted] = useThemeColor(["foreground", "muted"] as const);
  const filters = useLibraryFilters((state) => state.filters);
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const filtersOn = hasAppliedRecipeFilters(filters);

  return (
    <View className="gap-3.5 pt-7 pb-4">
      <View className="flex-row items-center justify-between px-5">
        <Text className="text-foreground text-2xl font-semibold" testID="library-heading">
          {intl.formatMessage({ id: HEADING_KEYS[filters.libraryType] })}
        </Text>
        <View className="bg-default h-9 flex-row gap-0.5 rounded-full p-[3px]">
          {VIEWS.map(({ mode, icon, label }) => (
            <Pressable
              key={mode}
              accessibilityLabel={intl.formatMessage({ id: label })}
              accessibilityRole="button"
              accessibilityState={{ selected: view === mode }}
              className={`h-[30px] w-[38px] items-center justify-center rounded-full ${view === mode ? "bg-surface" : ""}`}
              testID={`library-view-${mode}`}
              onPress={() => setView(mode)}
            >
              <Ionicons color={view === mode ? foreground : muted} name={icon} size={17} />
            </Pressable>
          ))}
        </View>
      </View>
      <View className="flex-row items-center gap-2 px-5">
        {LIBRARY_TYPE_FILTERS.map((type) => {
          const selected = filters.libraryType === type;

          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`h-9 justify-center rounded-full px-4 ${selected ? "bg-accent" : "bg-surface border-border border"}`}
              testID={`library-lens-${type}`}
              onPress={() => setFilters({ libraryType: type })}
            >
              <Text
                className={`text-[15px] font-medium ${selected ? "text-accent-foreground" : "text-foreground"}`}
              >
                {intl.formatMessage({ id: `recipes.dashboard.libraryType.${type}` })}
              </Text>
            </Pressable>
          );
        })}
        <View className="flex-1" />
        <Pressable
          accessibilityLabel={intl.formatMessage({ id: "common.filters.title" })}
          accessibilityRole="button"
          className="bg-surface border-border size-9 items-center justify-center rounded-full border"
          testID="library-filters-button"
          onPress={() => router.push("/filters")}
        >
          <Ionicons color={foreground} name="funnel-outline" size={17} />
          {filtersOn ? (
            <View
              className="bg-accent border-surface absolute top-[3px] right-[3px] size-[9px] rounded-full border-2"
              testID="library-filters-active"
            />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
