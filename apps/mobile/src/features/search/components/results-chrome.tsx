import React from "react";
import { ScrollView, Text, View } from "react-native";
import { NativeMenu } from "@/components/native-menu";
import { PressableScale } from "@/components/pressable-scale";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useIntl } from "react-intl";

import type { SortOrder } from "@norish/shared/contracts";
import { COOKING_TIME_OPTIONS, useLibraryFilters } from "@norish/shared-react/recipes";

import type { FilterChip } from "../utils/search-chips";
import { chipKey, filterChips, withoutChip } from "../utils/search-chips";
import { shownSort, sortOptions } from "../utils/search-sort";

const SORT_LABELS: Record<SortOrder, string> = {
  none: "recipes.search.sortBestMatch",
  dateDesc: "recipes.search.sortNewest",
  dateAsc: "recipes.search.sortOldest",
  titleAsc: "recipes.search.sortAZ",
  titleDesc: "recipes.search.sortZA",
};

/** What an applied filter's chip says. */
export function useChipLabel() {
  const intl = useIntl();
  const categoryLabel = useCategoryLabel();

  return (chip: FilterChip): string => {
    switch (chip.kind) {
      case "category":
        return categoryLabel(chip.value);
      case "tag":
        return chip.value;
      case "time": {
        const option = COOKING_TIME_OPTIONS.find((item) => item.value === chip.value);

        return option
          ? intl.formatMessage({ id: `common.filters.${option.labelKey}` })
          : `<${chip.value} min`;
      }
      case "rating":
        return intl.formatMessage({ id: "recipes.search.ratingChip" }, { count: chip.value });
      case "favorites":
        return intl.formatMessage({ id: "common.filters.favorites" });
      case "pantry":
        return intl.formatMessage({ id: "common.filters.pantryOnly" });
    }
  };
}

function FilterChipView({ chip, onRemove }: { chip: FilterChip; onRemove: () => void }) {
  const intl = useIntl();
  const muted = useTokenColor("muted");
  const label = useChipLabel()(chip);

  return (
    <PressableScale
      accessibilityLabel={intl.formatMessage(
        { id: "recipes.search.removeFilter" },
        { filter: label }
      )}
      accessibilityRole="button"
      className="bg-default h-9 flex-none flex-row items-center gap-1.5 rounded-full pr-2.5 pl-3.5"
      testID={`search-chip-${chipKey(chip)}`}
      onPress={onRemove}
    >
      <Text className="text-foreground text-[15px] font-medium">{label}</Text>
      <Ionicons color={muted} name="close" size={14} />
    </PressableScale>
  );
}

function SortChip() {
  const intl = useIntl();
  const muted = useTokenColor("muted");
  const sortMode = useLibraryFilters((state) => state.filters.sortMode);
  const hasText = useLibraryFilters((state) => state.filters.rawInput.trim() !== "");
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

/** Under the title: a chip for each applied filter (× removes it) and the sort chip. */
export function ChipRow() {
  const filters = useLibraryFilters((state) => state.filters);
  const setFilters = useLibraryFilters((state) => state.setFilters);

  return (
    <ScrollView
      horizontal
      contentContainerClassName="items-center gap-2 px-5"
      showsHorizontalScrollIndicator={false}
    >
      {filterChips(filters).map((chip) => (
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
