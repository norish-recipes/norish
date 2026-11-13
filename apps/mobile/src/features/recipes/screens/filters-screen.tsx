import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { FilterSection } from "@/features/recipes/components/filter-section";
import { ToggleChip } from "@/features/recipes/components/toggle-chip";
import { useWarningInkColor } from "@/hooks/use-warning-ink-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Button, Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { FilterMode, RecipeCategory } from "@norish/shared/contracts";
import { useCategoriesQuery, useTagsQuery } from "@norish/shared-react/config";
import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { COOKING_TIME_OPTIONS, useFiltersDraft } from "@norish/shared-react/recipes";
import { isBuiltInCategory } from "@norish/shared/lib/categories";

const MODES: { value: FilterMode; label: string }[] = [
  { value: "AND", label: "common.filters.modeAll" },
  { value: "OR", label: "common.filters.modeAny" },
];

const STARS = [1, 2, 3, 4, 5];

/** The Library's filters, web's less "Search in" (the Search tab owns search), applied together with Apply. */
export function FiltersScreen() {
  const intl = useIntl();
  const router = useRouter();
  const [foreground, muted, star] = useThemeColor(["foreground", "muted", "warning"] as const);
  const warningInk = useWarningInkColor();
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
  const categoryLabel = (name: RecipeCategory) =>
    isBuiltInCategory(name)
      ? intl.formatMessage({ id: `recipes.form.category.${name.toLowerCase()}` })
      : name;
  const close = () => router.back();

  return (
    <>
      {/* react-native-screens sizes a sheet's ScrollView as the content minus its first child (the footer, 84 pt),
          and moves it to that child's height unless it has a margin, so the scroll ends above the buttons. */}
      <View
        collapsable={false}
        className="absolute inset-x-0 bottom-0 flex-row gap-2.5 px-5 pt-3.5 pb-5"
      >
        <Button
          className="bg-warning/20 h-[50px] flex-1"
          testID="filters-reset"
          variant="secondary"
          onPress={() => {
            reset();
            close();
          }}
        >
          <Ionicons color={warningInk} name="refresh" size={18} />
          <Button.Label className="text-warning-ink">
            {intl.formatMessage({ id: "common.filters.clearFilters" })}
          </Button.Label>
        </Button>
        <Button
          className="h-[50px] flex-1"
          testID="filters-apply"
          variant="primary"
          onPress={() => {
            apply();
            close();
          }}
        >
          <Ionicons color="white" name="checkmark" size={20} />
          <Button.Label>{intl.formatMessage({ id: "common.actions.apply" })}</Button.Label>
        </Button>
      </View>
      <ScrollView
        className="mt-px"
        contentContainerClassName="gap-[18px] px-5 pt-5 pb-4"
        testID="filters-sheet"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between pl-2">
          <Text className="text-foreground text-[22px] font-semibold">
            {intl.formatMessage({ id: "common.filters.title" })}
          </Text>
          <Pressable
            accessibilityLabel={intl.formatMessage({ id: "common.actions.close" })}
            accessibilityRole="button"
            className="bg-surface size-10 items-center justify-center rounded-full"
            testID="filters-close"
            onPress={close}
          >
            <Ionicons color={foreground} name="close" size={20} />
          </Pressable>
        </View>

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
            <View className="bg-default flex-row gap-0.5 rounded-full p-[3px]">
              {MODES.map(({ value, label }) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.filterMode === value }}
                  className={`h-[26px] justify-center rounded-full px-3 ${draft.filterMode === value ? "bg-surface" : ""}`}
                  testID={`filters-mode-${value}`}
                  onPress={() => update({ filterMode: value })}
                >
                  <Text
                    className="text-[13px] font-medium"
                    style={{ color: draft.filterMode === value ? foreground : muted }}
                  >
                    {intl.formatMessage({ id: label })}
                  </Text>
                </Pressable>
              ))}
            </View>
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
      </ScrollView>
    </>
  );
}
