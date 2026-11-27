import type { TabScroll } from "@/lib/use-tab-scroll";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { CardPhoto } from "@/components/card-photo";
import { Ionicons } from "@/components/icon";
import { PressableScale } from "@/components/pressable-scale";
import { Section } from "@/components/section";
import { ToggleChip } from "@/components/toggle-chip";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useTokenColor } from "@/hooks/use-token-color";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { useLibraryDiscover, useLibraryFilters } from "@norish/shared-react/recipes";

import type { SectionRead } from "../utils/discover";
import { useRecentSearches } from "../hooks/use-recent-searches";
import { discoverSections } from "../utils/discover";
import { quickFilters } from "../utils/search-chips";
import { SearchScroll } from "./search-scroll";

const TILE_COUNT = 4;
const SKELETON_TAG_WIDTHS = ["w-24", "w-28", "w-24", "w-20", "w-24", "w-16"];

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
      dense
      title={intl.formatMessage({ id: "recipes.search.recent" })}
      trailing={
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
    >
      <Card surface testID="search-recent">
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
  onPress,
}: {
  name: string;
  image: string | null;
  onPress: () => void;
}) {
  const label = useCategoryLabel()(name);

  return (
    <PressableScale
      accessibilityRole="button"
      className="h-[84px] w-[48.5%] justify-end overflow-hidden rounded-[20px]"
      testID={`search-category-${name}`}
      onPress={onPress}
    >
      <CardPhoto className="absolute inset-0" image={image} />
      <View className="absolute inset-0 bg-black/35" />
      <Text className="px-3.5 pb-[11px] text-[17px] font-semibold text-white">{label}</Text>
    </PressableScale>
  );
}

function CategoriesSection({
  categories,
  onPick,
}: {
  categories: { name: string; image: string | null }[] | undefined;
  onPick: (patch: Partial<CanonicalRecipeFilters>) => void;
}) {
  const intl = useIntl();

  return (
    <Section dense title={intl.formatMessage({ id: "common.filters.categories" })}>
      <View className="flex-row flex-wrap justify-between gap-y-2.5" testID="search-categories">
        {categories
          ? categories.map((category) => (
              <CategoryTile
                key={category.name}
                image={category.image}
                name={category.name}
                onPress={() => onPick({ categories: [category.name] })}
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
  onPick,
}: {
  onPick: (patch: Partial<CanonicalRecipeFilters>) => void;
}) {
  const intl = useIntl();
  const visibility = useHiddenItemVisibility();

  return (
    <Section dense title={intl.formatMessage({ id: "recipes.search.quickFilters" })}>
      <View className="flex-row flex-wrap gap-2" testID="search-quick-filters">
        {quickFilters(visibility).map((quick) => (
          <ToggleChip
            key={quick.kind}
            solid
            active={false}
            icon={quick.icon}
            mutedIcon={quick.icon !== "star"}
            label={intl.formatMessage({ id: quick.labelId })}
            testID={`search-quick-${quick.kind}`}
            onPress={() => onPick(quick.on)}
          />
        ))}
      </View>
    </Section>
  );
}

function TagsSection({
  tags,
  onPick,
}: {
  tags: string[] | undefined;
  onPick: (patch: Partial<CanonicalRecipeFilters>) => void;
}) {
  const intl = useIntl();

  return (
    <Section dense title={intl.formatMessage({ id: "common.filters.tags" })}>
      <View className="flex-row flex-wrap gap-2" testID="search-tags">
        {tags
          ? tags.map((tag) => (
              <ToggleChip
                key={tag}
                solid
                active={false}
                label={tag}
                testID={`search-tag-${tag}`}
                onPress={() => onPick({ searchTags: [tag] })}
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
 * Tags. It shows only with no chip applied, so a tap's chip is the only one; `onPicked` follows. */
export function Discover({
  focused,
  scroll,
  onRun,
  onEdit,
  onPicked,
}: {
  focused: boolean;
  scroll: TabScroll;
  onRun: (text: string) => void;
  onEdit: (text: string) => void;
  onPicked: () => void;
}) {
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const { recents } = useRecentSearches();
  const discover = useLibraryDiscover();
  const { isOffline } = useConnectivity();
  const read = (count: number | undefined): SectionRead =>
    count ?? (discover.isError ? "failed" : "loading");
  const sections = discoverSections({
    focused,
    recentCount: recents.length,
    categories: read(discover.data?.categories.length),
    tags: read(discover.data?.tags.length),
    offline: isOffline,
  });
  const pick = (patch: Partial<CanonicalRecipeFilters>) => {
    setFilters(patch);
    onPicked();
  };

  return (
    <SearchScroll
      contentContainerClassName="gap-[22px] px-5 pt-5 pb-96"
      scroll={scroll}
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
                onPick={pick}
              />
            );
          case "quickFilters":
            return <QuickFiltersSection key={section} onPick={pick} />;
          case "tags":
            return <TagsSection key={section} tags={discover.data?.tags} onPick={pick} />;
        }
      })}
    </SearchScroll>
  );
}
