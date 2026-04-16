import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PanelButton } from "@/components/shell/panel-button";
import { ShellSheet } from "@/components/shell/sheet";
import { useTagsQuery } from "@/hooks/config";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { CanonicalRecipeFilters } from "@norish/shared-react/contexts";
import type { RecipeCategory } from "@norish/shared/contracts";
import {
  DEFAULT_RECIPE_FILTERS,
  RECIPE_CATEGORY_OPTIONS,
  RECIPE_COOKING_TIME_OPTIONS,
} from "@norish/shared-react/contexts";

function SectionHeader({ title }: { title: string }) {
  const [foregroundColor] = useThemeColor(["foreground"] as const);
  return <Text style={[sectionStyles.header, { color: foregroundColor }]}>{title}</Text>;
}

function ChipToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const [accentColor, foregroundColor, surfaceColor, separatorColor] = useThemeColor([
    "accent",
    "foreground",
    "surface",
    "separator",
  ] as const);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        chipStyles.chip,
        {
          backgroundColor: active ? accentColor : surfaceColor,
          borderColor: active ? accentColor : separatorColor,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[chipStyles.label, { color: active ? "#ffffff" : foregroundColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface FilterSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CanonicalRecipeFilters;
  onApply: (filters: Partial<CanonicalRecipeFilters>) => void;
}

export function FilterSheet({ isOpen, onOpenChange, filters, onApply }: FilterSheetProps) {
  const intl = useIntl();
  const [draft, setDraft] = useState<CanonicalRecipeFilters>(filters);
  const [tagFilter, setTagFilter] = useState("");
  const [titleColor, mutedColor, accentForegroundColor, surfaceColor, separatorColor] =
    useThemeColor(["foreground", "muted", "accent-foreground", "surface", "separator"] as const);
  const { tags, isLoading: isTagsLoading } = useTagsQuery();
  const tagOptions: string[] = isTagsLoading ? draft.searchTags : tags;

  React.useEffect(() => {
    if (isOpen) {
      setDraft(filters);
      setTagFilter("");
    }
  }, [isOpen, filters]);

  const handleApply = useCallback(() => {
    onApply(draft);
    onOpenChange(false);
  }, [draft, onApply, onOpenChange]);

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_RECIPE_FILTERS);
  }, []);

  const toggleCategory = useCallback((category: RecipeCategory) => {
    setDraft((previous) => {
      const hasCategory = previous.categories.includes(category);
      return {
        ...previous,
        categories: hasCategory
          ? previous.categories.filter((item) => item !== category)
          : [...previous.categories, category],
      };
    });
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setDraft((previous) => {
      const hasTag = previous.searchTags.includes(tag);
      return {
        ...previous,
        searchTags: hasTag
          ? previous.searchTags.filter((item) => item !== tag)
          : [...previous.searchTags, tag],
      };
    });
  }, []);

  return (
    <ShellSheet isPresented={isOpen} onIsPresentedChange={onOpenChange}>
      <View style={sheetStyles.container}>
        <View style={sheetStyles.titleRow}>
          <Text style={[sheetStyles.title, { color: titleColor }]}>
            {intl.formatMessage({ id: "common.filters.title" })}
          </Text>
          <Text style={[sheetStyles.subtitle, { color: mutedColor }]}>
            {intl.formatMessage({ id: "common.actions.filter" })}
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sheetStyles.scrollContent}
          style={sheetStyles.scrollWrapper}
        >
          <View style={sectionStyles.section}>
            <SectionHeader title={intl.formatMessage({ id: "common.filters.cookingTime" })} />
            <View style={sectionStyles.chipRow}>
              {RECIPE_COOKING_TIME_OPTIONS.map((option) => (
                <ChipToggle
                  key={option.value}
                  label={option.label}
                  active={draft.maxCookingTime === option.value}
                  onPress={() =>
                    setDraft((previous) => ({
                      ...previous,
                      maxCookingTime:
                        previous.maxCookingTime === option.value ? null : option.value,
                    }))
                  }
                />
              ))}
            </View>
          </View>

          <View style={sectionStyles.section}>
            <SectionHeader title={intl.formatMessage({ id: "common.filters.categories" })} />
            <View style={sectionStyles.chipRow}>
              {RECIPE_CATEGORY_OPTIONS.map((category) => (
                <ChipToggle
                  key={category}
                  label={category}
                  active={draft.categories.includes(category)}
                  onPress={() => toggleCategory(category)}
                />
              ))}
            </View>
          </View>

          <View style={sectionStyles.section}>
            <SectionHeader title={intl.formatMessage({ id: "common.filters.favorites" })} />
            <View style={sectionStyles.chipRow}>
              <ChipToggle
                label={intl.formatMessage({ id: "common.filters.favorites" })}
                active={draft.showFavoritesOnly}
                onPress={() =>
                  setDraft((previous) => ({
                    ...previous,
                    showFavoritesOnly: !previous.showFavoritesOnly,
                  }))
                }
              />
            </View>
          </View>

          <View style={sectionStyles.section}>
            <SectionHeader
              title={intl.formatMessage({ id: "common.filters.favoritesAndRating" })}
            />
            <View style={sectionStyles.chipRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <ChipToggle
                  key={star}
                  label={"★".repeat(star)}
                  active={draft.minRating === star}
                  onPress={() =>
                    setDraft((previous) => ({
                      ...previous,
                      minRating: previous.minRating === star ? null : star,
                    }))
                  }
                />
              ))}
            </View>
          </View>

          <View style={sectionStyles.section}>
            <SectionHeader title={intl.formatMessage({ id: "common.filters.tags" })} />
            <TextInput
              value={tagFilter}
              onChangeText={setTagFilter}
              placeholder={intl.formatMessage({ id: "common.filters.searchTags" })}
              placeholderTextColor={mutedColor}
              style={[
                sectionStyles.tagInput,
                { color: titleColor, borderColor: separatorColor, backgroundColor: surfaceColor },
              ]}
            />
            <View style={sectionStyles.chipRow}>
              {tagOptions
                .filter((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))
                .map((tag) => (
                  <ChipToggle
                    key={tag}
                    label={tag}
                    active={draft.searchTags.includes(tag)}
                    onPress={() => toggleTag(tag)}
                  />
                ))}
            </View>
          </View>
        </ScrollView>

        <View style={sheetStyles.footer}>
          <PanelButton variant="secondary" onPress={handleReset}>
            <Ionicons name="refresh-outline" size={18} color={titleColor} />
            <Button.Label style={{ color: titleColor }}>
              {intl.formatMessage({ id: "common.actions.reset" })}
            </Button.Label>
          </PanelButton>
          <PanelButton variant="primary" onPress={handleApply}>
            <Ionicons name="checkmark-outline" size={18} color={accentForegroundColor} />
            <Button.Label>{intl.formatMessage({ id: "common.actions.apply" })}</Button.Label>
          </PanelButton>
        </View>
      </View>
    </ShellSheet>
  );
}

const sectionStyles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
});

const sheetStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  titleRow: {
    gap: 3,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    paddingBottom: 16,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
});
