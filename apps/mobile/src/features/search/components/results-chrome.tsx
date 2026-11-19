import React from "react";
import { ScrollView, Text, View } from "react-native";
import { IngredientIcon } from "@/components/ingredient-icon";
import { NativeMenu } from "@/components/native-menu";
import { PressableScale } from "@/components/pressable-scale";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useIntl } from "react-intl";

import type { SortOrder } from "@norish/shared/contracts";
import { useIngredientIcons, useIngredientNames } from "@norish/shared-react/ingredients";
import { useLibraryFilters } from "@norish/shared-react/recipes";

import type { ChipSpeech, FilterChip } from "../utils/search-chips";
import { useSearchFilters } from "../hooks/use-search-filters";
import { chipIcon, chipKey, chipLabel, withoutChip } from "../utils/search-chips";
import { shownSort, sortOptions } from "../utils/search-sort";

const SORT_LABELS: Record<SortOrder, string> = {
  none: "recipes.search.sortBestMatch",
  dateDesc: "recipes.search.sortNewest",
  dateAsc: "recipes.search.sortOldest",
  titleAsc: "recipes.search.sortAZ",
  titleDesc: "recipes.search.sortZA",
};

/** How chips speak; an Ingredient is named by its current name, empty until read or if gone. */
function useChipSpeech(ingredientIds: readonly string[]): ChipSpeech {
  const intl = useIntl();
  const category = useCategoryLabel();
  const names = useIngredientNames(ingredientIds, intl.locale);

  return {
    say: (id, values) => intl.formatMessage({ id }, values),
    category,
    ingredient: (ingredientId) => names.get(ingredientId) ?? "",
  };
}

function FilterChipView({
  chip,
  speech,
  onRemove,
}: {
  chip: FilterChip;
  speech: ChipSpeech;
  onRemove: () => void;
}) {
  const intl = useIntl();
  const muted = useTokenColor("muted");
  const label = chipLabel(chip, speech);
  const icon = chipIcon(chip);

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
      {icon ? <IngredientIcon ingredientId={icon} size={20} /> : null}
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

/** Under the title: a chip for each of `chips` (× removes it) and the sort chip. */
export function ChipRow({ chips }: { chips: FilterChip[] }) {
  const filters = useSearchFilters();
  const setFilters = useLibraryFilters((state) => state.setFilters);

  // One read for every Ingredient chip's icon; the row that added it has usually read it already.
  useIngredientIcons(filters.ingredients);
  const speech = useChipSpeech(filters.ingredients);

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
          speech={speech}
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
