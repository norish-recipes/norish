import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { CardPhoto } from "@/components/card-photo";
import { SectionLabel } from "@/components/section-label";
import { ToggleChip } from "@/components/toggle-chip";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { useLibraryDiscover, useLibraryFilters } from "@norish/shared-react/recipes";

import type { SectionRead } from "../utils/discover";
import { useRecentSearches } from "../hooks/use-recent-searches";
import {
  discoverSections,
  isCategoryOn,
  isTagOn,
  offeredQuickFilters,
  toggleCategory,
  toggleQuickFilter,
  toggleTag,
} from "../utils/discover";

const TILE_COUNT = 4;
const SKELETON_TAG_WIDTHS = ["w-24", "w-28", "w-24", "w-20", "w-24", "w-16"];

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <SectionLabel>{title}</SectionLabel>
        {action}
      </View>
      {children}
    </View>
  );
}

function RecentSection({
  onRun,
  onEdit,
}: {
  onRun: (text: string) => void;
  onEdit: (text: string) => void;
}) {
  const intl = useIntl();
  const muted = useTokenColor("muted");
  const accent = useTokenColor("accent-text");
  const { recents, clear } = useRecentSearches();

  return (
    <Section
      action={
        <Pressable
          accessibilityRole="button"
          className="px-2"
          hitSlop={8}
          testID="search-recent-clear"
          onPress={clear}
        >
          <Text className="text-[15px]" style={{ color: accent }}>
            {intl.formatMessage({ id: "common.actions.clear" })}
          </Text>
        </Pressable>
      }
      title={intl.formatMessage({ id: "recipes.search.recent" })}
    >
      <Card testID="search-recent">
        {recents.map((text, index) => (
          <CardRow
            key={text}
            chevron={false}
            first={index === 0}
            label={text}
            leading={<Ionicons color={muted} name="time-outline" size={18} />}
            testID={`search-recent-${index}`}
            onPress={() => onRun(text)}
          >
            <Pressable
              accessibilityLabel={intl.formatMessage({ id: "recipes.search.editRecent" }, { text })}
              accessibilityRole="button"
              hitSlop={10}
              testID={`search-recent-edit-${index}`}
              onPress={() => onEdit(text)}
            >
              <Ionicons
                color={muted}
                name="arrow-up"
                size={16}
                style={{ transform: [{ rotate: "-45deg" }] }}
              />
            </Pressable>
          </CardRow>
        ))}
      </Card>
    </Section>
  );
}

function CategoryTile({
  name,
  image,
  on,
  onPress,
}: {
  name: string;
  image: string | null;
  on: boolean;
  onPress: () => void;
}) {
  const label = useCategoryLabel()(name);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      className="h-[84px] w-[48.5%] justify-end overflow-hidden rounded-[20px]"
      testID={`search-category-${name}`}
      onPress={onPress}
    >
      <CardPhoto className="absolute inset-0" image={image} />
      <View className="absolute inset-0 bg-black/35" />
      <Text className="px-3.5 pb-[11px] text-[17px] font-semibold text-white">
        {on ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

function CategoriesSection({
  categories,
  filters,
  onPick,
}: {
  categories: { name: string; image: string | null }[] | undefined;
  filters: CanonicalRecipeFilters;
  onPick: (patch: Partial<CanonicalRecipeFilters>) => void;
}) {
  const intl = useIntl();

  return (
    <Section title={intl.formatMessage({ id: "common.filters.categories" })}>
      <View className="flex-row flex-wrap justify-between gap-y-2.5" testID="search-categories">
        {categories
          ? categories.map((category) => (
              <CategoryTile
                key={category.name}
                image={category.image}
                name={category.name}
                on={isCategoryOn(filters, category.name)}
                onPress={() => onPick(toggleCategory(filters, category.name))}
              />
            ))
          : Array.from({ length: TILE_COUNT }, (_, index) => (
              <Skeleton key={index} className="h-[84px] w-[48.5%] rounded-[20px]" />
            ))}
      </View>
    </Section>
  );
}

function QuickFiltersSection({
  filters,
  onPick,
}: {
  filters: CanonicalRecipeFilters;
  onPick: (patch: Partial<CanonicalRecipeFilters>) => void;
}) {
  const intl = useIntl();
  const visibility = useHiddenItemVisibility();

  return (
    <Section title={intl.formatMessage({ id: "recipes.search.quickFilters" })}>
      <View className="flex-row flex-wrap gap-2" testID="search-quick-filters">
        {offeredQuickFilters(visibility).map((quick) => (
          <ToggleChip
            key={quick.key}
            active={quick.isOn(filters)}
            icon={quick.icon}
            label={intl.formatMessage({ id: quick.labelId })}
            testID={`search-quick-${quick.key}`}
            onPress={() => onPick(toggleQuickFilter(filters, quick))}
          />
        ))}
      </View>
    </Section>
  );
}

function TagsSection({
  tags,
  filters,
  onPick,
}: {
  tags: string[] | undefined;
  filters: CanonicalRecipeFilters;
  onPick: (patch: Partial<CanonicalRecipeFilters>) => void;
}) {
  const intl = useIntl();

  return (
    <Section title={intl.formatMessage({ id: "common.filters.tags" })}>
      <View className="flex-row flex-wrap gap-2" testID="search-tags">
        {tags
          ? tags.map((tag) => (
              <ToggleChip
                key={tag}
                active={isTagOn(filters, tag)}
                label={tag}
                testID={`search-tag-${tag}`}
                onPress={() => onPick(toggleTag(filters, tag))}
              />
            ))
          : SKELETON_TAG_WIDTHS.map((width, index) => (
              <Skeleton key={index} className={`h-9 rounded-full ${width}`} />
            ))}
      </View>
    </Section>
  );
}

/** The page with no text: Recent Searches, Categories, and with the keyboard down Quick filters and
 * Tags. A tap on a Category, Quick filter or Tag toggles its chip; `onPicked` is told after it. */
export function Discover({
  focused,
  filters,
  onRun,
  onEdit,
  onPicked,
}: {
  focused: boolean;
  filters: CanonicalRecipeFilters;
  onRun: (text: string) => void;
  onEdit: (text: string) => void;
  onPicked: () => void;
}) {
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const { recents } = useRecentSearches();
  const discover = useLibraryDiscover();
  const read = (count: number | undefined): SectionRead =>
    count ?? (discover.isError ? "failed" : "loading");
  const sections = discoverSections({
    focused,
    recentCount: recents.length,
    categories: read(discover.data?.categories.length),
    tags: read(discover.data?.tags.length),
  });
  const pick = (patch: Partial<CanonicalRecipeFilters>) => {
    setFilters(patch);
    onPicked();
  };

  return (
    <ScrollView
      contentContainerClassName="gap-[22px] px-5 pt-5 pb-96"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      testID="search-screen"
    >
      {sections.map((section) => {
        switch (section) {
          case "recent":
            return <RecentSection key={section} onEdit={onEdit} onRun={onRun} />;
          case "categories":
            return (
              <CategoriesSection
                key={section}
                categories={discover.data?.categories}
                filters={filters}
                onPick={pick}
              />
            );
          case "quickFilters":
            return <QuickFiltersSection key={section} filters={filters} onPick={pick} />;
          case "tags":
            return (
              <TagsSection
                key={section}
                filters={filters}
                tags={discover.data?.tags}
                onPick={pick}
              />
            );
        }
      })}
    </ScrollView>
  );
}
