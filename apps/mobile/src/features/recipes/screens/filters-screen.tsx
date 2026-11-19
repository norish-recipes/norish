import React from "react";
import { Pressable, Text, View } from "react-native";
import { Segmented } from "@/components/segmented";
import { Sheet, SheetScrollView } from "@/components/sheet";
import { ToggleChip } from "@/components/toggle-chip";
import { FilterSection } from "@/features/recipes/components/filter-section";
import { useCategoryLabel } from "@/hooks/use-category-label";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { FilterMode } from "@norish/shared/contracts";
import { useCategoriesQuery, useTagsQuery } from "@norish/shared-react/config";
import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { COOKING_TIME_OPTIONS, useFiltersDraft } from "@norish/shared-react/recipes";

const MODES: { value: FilterMode; label: string }[] = [
  { value: "AND", label: "common.filters.modeAll" },
  { value: "OR", label: "common.filters.modeAny" },
];

const STARS = [1, 2, 3, 4, 5];

/** The Library's filters, web's less "Search in" (the Search tab owns search), applied together with Apply. */
export function FiltersScreen() {
  const intl = useIntl();
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
  const [star] = useThemeColor(["warning"] as const);
  const { showRatings, showFavorites } = useHiddenItemVisibility();
  const {
    draft,
    update,
    toggleTag,
    toggleCategory,
    toggleCookingTime,
    decideSortOrder,
    reset,
    apply,
  } = useFiltersDraft();
  const { categories: householdCategories } = useCategoriesQuery();
  const { tags, isLoading: tagsLoading } = useTagsQuery();
  // A stored filter stays visible, so it can be cleared, even once the list drops it.
  const categories = Array.from(new Set([...householdCategories, ...draft.categories]));
  const close = () => router.back();

  return (
    <Sheet
      confirm={{
        label: intl.formatMessage({ id: "common.actions.apply" }),
        onPress: () => {
          apply();
          close();
        },
      }}
      name="filters"
      secondary={[
        {
          label: intl.formatMessage({ id: "common.filters.clearFilters" }),
          symbol: "arrow.counterclockwise",
          onPress: () => {
            reset();
            close();
          },
        },
      ]}
      title={intl.formatMessage({ id: "common.filters.title" })}
    >
      <SheetScrollView contentClassName="gap-[18px]">
        <FilterSection title={intl.formatMessage({ id: "common.filters.sort" })}>
          <View className="flex-row flex-wrap gap-1.5">
            {(["title", "date"] as const).map((key) => {
              const active = draft.sortMode.startsWith(key);

              return (
                <ToggleChip
                  key={key}
                  active={active}
                  icon={
                    active
                      ? draft.sortMode === `${key}Asc`
                        ? "arrow-up"
                        : "arrow-down"
                      : undefined
                  }
                  label={intl.formatMessage({
                    id:
                      key === "title" ? "common.filters.sortByTitle" : "common.filters.sortByDate",
                  })}
                  testID={`filters-sort-${key}`}
                  onPress={() => decideSortOrder(key)}
                />
              );
            })}
          </View>
        </FilterSection>

        {showFavorites || showRatings ? (
          <View className="flex-row gap-[18px]">
            {showFavorites ? (
              <FilterSection title={intl.formatMessage({ id: "common.filters.favorites" })}>
                <ToggleChip
                  active={draft.showFavoritesOnly}
                  icon="heart-outline"
                  label={intl.formatMessage({ id: "common.filters.favorites" })}
                  testID="filters-favorites"
                  onPress={() => update({ showFavoritesOnly: !draft.showFavoritesOnly })}
                />
              </FilterSection>
            ) : null}
            {showRatings ? (
              <FilterSection title={intl.formatMessage({ id: "common.filters.minRating" })}>
                <View className="h-[34px] flex-row items-center gap-0.5">
                  {STARS.map((value) => (
                    <Pressable
                      key={value}
                      accessibilityLabel={`${value}+`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: draft.minRating === value }}
                      hitSlop={4}
                      testID={`filters-rating-${value}`}
                      onPress={() =>
                        update({ minRating: draft.minRating === value ? null : value })
                      }
                    >
                      <Ionicons
                        color={star}
                        name={
                          draft.minRating !== null && value <= draft.minRating
                            ? "star"
                            : "star-outline"
                        }
                        size={22}
                      />
                    </Pressable>
                  ))}
                  {draft.minRating !== null ? (
                    <Text className="text-muted ml-1.5 text-sm">{`${draft.minRating}+`}</Text>
                  ) : null}
                </View>
              </FilterSection>
            ) : null}
          </View>
        ) : null}

        <FilterSection title={intl.formatMessage({ id: "common.filters.pantry" })}>
          <View className="flex-row">
            <ToggleChip
              active={draft.showPantryOnly}
              icon="file-tray-full-outline"
              label={intl.formatMessage({ id: "common.filters.pantryOnly" })}
              testID="filters-pantry"
              onPress={() => update({ showPantryOnly: !draft.showPantryOnly })}
            />
          </View>
        </FilterSection>

        <FilterSection title={intl.formatMessage({ id: "common.filters.cookingTime" })}>
          <View className="flex-row flex-wrap gap-1.5">
            {COOKING_TIME_OPTIONS.map(({ value, labelKey }) => (
              <ToggleChip
                key={value}
                active={draft.maxCookingTime === value}
                label={intl.formatMessage({ id: `common.filters.${labelKey}` })}
                testID={`filters-time-${value}`}
                onPress={() => toggleCookingTime(value)}
              />
            ))}
          </View>
        </FilterSection>

        <FilterSection title={intl.formatMessage({ id: "common.filters.categories" })}>
          <View className="flex-row flex-wrap gap-1.5">
            {categories.map((category) => (
              <ToggleChip
                key={category}
                active={draft.categories.includes(category)}
                label={categoryLabel(category)}
                testID={`filters-category-${category}`}
                onPress={() => toggleCategory(category)}
              />
            ))}
          </View>
        </FilterSection>

        <FilterSection
          title={intl.formatMessage({ id: "common.filters.tags" })}
          trailing={
            <Segmented
              segments={MODES.map(({ value, label }) => ({
                value,
                label: intl.formatMessage({ id: label }),
                testID: `filters-mode-${value}`,
              }))}
              size="compact"
              testID="filters-mode"
              value={draft.filterMode}
              onChange={(value) => update({ filterMode: value })}
            />
          }
        >
          {tagsLoading ? (
            <View className="flex-row flex-wrap gap-1.5">
              {[72, 96, 64, 88].map((width) => (
                <Skeleton key={width} className="h-[34px] rounded-full" style={{ width }} />
              ))}
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-1.5">
              {tags.map((tag) => (
                <ToggleChip
                  key={tag}
                  active={draft.searchTags.includes(tag)}
                  label={tag}
                  testID={`filters-tag-${tag}`}
                  onPress={() => toggleTag(tag)}
                />
              ))}
            </View>
          )}
        </FilterSection>
      </SheetScrollView>
    </Sheet>
  );
}
