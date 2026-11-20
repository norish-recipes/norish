import React from "react";
import { ScrollView, Text, View } from "react-native";
import { NativeMenu } from "@/components/native-menu";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useIntl } from "react-intl";

import type { SortOrder } from "@norish/shared/contracts";
import { useIngredientIcons, useIngredientNames } from "@norish/shared-react/ingredients";
import { useLibraryFilters } from "@norish/shared-react/recipes";
import { hasSearchText } from "@norish/shared/lib/search-terms";

import type { FilterChip } from "../utils/search-chips";
import { useSearchFilters } from "../hooks/use-search-filters";
import { chipKey, withoutChip } from "../utils/search-chips";
import { shownSort, sortOptions } from "../utils/search-sort";
import { FilterChipView } from "./filter-chip";

const SORT_LABELS: Record<SortOrder, string> = {
  none: "recipes.search.sortBestMatch",
  dateDesc: "recipes.search.sortNewest",
  dateAsc: "recipes.search.sortOldest",
  titleAsc: "recipes.search.sortAZ",
  titleDesc: "recipes.search.sortZA",
};

function SortChip() {
  const intl = useIntl();
  const muted = useTokenColor("muted");
  const sortMode = useLibraryFilters((state) => state.filters.sortMode);
  const hasText = useLibraryFilters((state) => hasSearchText(state.filters.rawInput));
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const shown = shownSort(sortMode, hasText);
  const label = intl.formatMessage({ id: SORT_LABELS[shown] });

  return (
    <NativeMenu
      items={sortOptions(hasText).map((option) => ({
        key: option,
        label: intl.formatMessage({ id: SORT_LABELS[option] }),
        systemImage: option === shown ? "checkmark" : undefined,
        onPress: () => setFilters({ sortMode: option }),
      }))}
      label={intl.formatMessage({ id: "recipes.search.sortLabel" }, { sort: label })}
      testID="search-sort"
    >
      <View className="bg-default h-9 flex-row items-center gap-1.5 rounded-full px-3">
        <Ionicons color={muted} name="swap-vertical" size={15} />
        <Text className="text-foreground text-[15px] font-medium">{label}</Text>
        <Ionicons color={muted} name="chevron-down" size={14} />
      </View>
    </NativeMenu>
  );
}

/** Under the title: a chip for each of `chips` (× removes it) and the sort chip. */
export function ChipRow({ chips }: { chips: FilterChip[] }) {
  const filters = useSearchFilters();
  const setFilters = useLibraryFilters((state) => state.setFilters);

  // One read each for every Ingredient chip's icon and name; what added a chip has usually primed both.
  useIngredientIcons(filters.ingredients);
  useIngredientNames(filters.ingredients);

  return (
    <ScrollView
      horizontal
      contentContainerClassName="items-center gap-2 px-5"
      showsHorizontalScrollIndicator={false}
    >
      {chips.map((chip) => (
        <FilterChipView
          key={chipKey(chip)}
          chip={chip}
          onRemove={() => setFilters(withoutChip(filters, chip))}
        />
      ))}
      <SortChip />
    </ScrollView>
  );
}

/** "3 recipes", under the chips. */
export function RecipeCount({ count }: { count: number }) {
  const intl = useIntl();

  return (
    <Text className="text-muted mt-4 mb-2.5 px-6 text-sm" testID="search-count">
      {intl.formatMessage({ id: "recipes.search.count" }, { count })}
    </Text>
  );
}
