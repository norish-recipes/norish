import React from "react";
import { Text, View } from "react-native";
import { Section } from "@/components/section";
import { Segmented } from "@/components/segmented";
import { Sheet, SheetScrollView } from "@/components/sheet";
import { StarRating } from "@/components/star-rating";
import { ToggleChip } from "@/components/toggle-chip";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useRouter } from "expo-router";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { FilterMode } from "@norish/shared/contracts";
import { useCategoriesQuery, useTagsQuery } from "@norish/shared-react/config";
import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { COOKING_TIME_OPTIONS, useFiltersDraft } from "@norish/shared-react/recipes";

const MODES: { value: FilterMode; label: string }[] = [
  { value: "AND", label: "common.filters.modeAll" },
  { value: "OR", label: "common.filters.modeAny" },
];

/** The Library's filters in web's order, less search and "Search in" (the Search tab owns search),
 * applied together with Apply. */
export function FiltersScreen() {
  const intl = useIntl();
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
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
      <SheetScrollView contentClassName="gap-3">
        <Section title={intl.formatMessage({ id: "common.filters.sort" })}>
          <View className="flex-row flex-wrap gap-2">
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
        </Section>

        <Section title={intl.formatMessage({ id: "common.filters.mode" })}>
          <Segmented
            segments={MODES.map(({ value, label }) => ({
              value,
              label: intl.formatMessage({ id: label }),
              testID: `filters-mode-${value}`,
            }))}
            testID="filters-mode"
            value={draft.filterMode}
            onChange={(value) => update({ filterMode: value })}
          />
        </Section>

        {showFavorites ? (
          <Section title={intl.formatMessage({ id: "common.filters.favorites" })}>
            <View className="flex-row">
              <ToggleChip
                active={draft.showFavoritesOnly}
                icon="heart-outline"
                label={intl.formatMessage({ id: "common.filters.favorites" })}
                testID="filters-favorites"
                onPress={() => update({ showFavoritesOnly: !draft.showFavoritesOnly })}
              />
            </View>
          </Section>
        ) : null}

        {showRatings ? (
          <Section
            title={intl.formatMessage({ id: "common.filters.minRating" })}
            trailing={
              draft.minRating === null ? null : (
                <Text className="text-muted text-[13px] font-medium">{`${draft.minRating}+`}</Text>
              )
            }
          >
            <StarRating
              labelFor={(count) =>
                intl.formatMessage({ id: "common.filters.minRatingStars" }, { count })
              }
              testID="filters-rating"
              value={draft.minRating}
              onChange={(minRating) => update({ minRating })}
            />
          </Section>
        ) : null}

        <Section title={intl.formatMessage({ id: "common.filters.pantry" })}>
          <View className="flex-row">
            <ToggleChip
              active={draft.showPantryOnly}
              icon="file-tray-full-outline"
              label={intl.formatMessage({ id: "common.filters.pantryOnly" })}
              testID="filters-pantry"
              onPress={() => update({ showPantryOnly: !draft.showPantryOnly })}
            />
          </View>
        </Section>

        <Section title={intl.formatMessage({ id: "common.filters.cookingTime" })}>
          <View className="flex-row flex-wrap gap-2">
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
        </Section>

        <Section title={intl.formatMessage({ id: "common.filters.categories" })}>
          <View className="flex-row flex-wrap gap-2">
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
        </Section>

        <Section title={intl.formatMessage({ id: "common.filters.tags" })}>
          {tagsLoading ? (
            <View className="flex-row flex-wrap gap-2">
              {[72, 96, 64, 88].map((width) => (
                <Skeleton key={width} className="h-9 rounded-full" style={{ width }} />
              ))}
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-2">
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
        </Section>
      </SheetScrollView>
    </Sheet>
  );
}
