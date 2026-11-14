import type { ComponentProps } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { useWarningInkColor } from "@/hooks/use-warning-ink-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** A centred card for a list with nothing in it: an icon, a title and at most one line under it. */
function EmptyCard({
  icon,
  title,
  description,
  testID,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description?: string;
  testID: string;
}) {
  const accentText = useAccentTextColor();

  return (
    <View
      className="bg-surface mx-5 items-center gap-2 rounded-[26px] px-7 pt-8 pb-7"
      testID={testID}
    >
      <View className="bg-accent/10 mb-2 size-16 items-center justify-center rounded-[20px]">
        <Ionicons color={accentText} name={icon} size={30} />
      </View>
      <Text className="text-foreground text-xl font-semibold">{title}</Text>
      {description ? (
        <Text className="text-muted text-center text-[15px] leading-[21px]">{description}</Text>
      ) : null}
    </View>
  );
}

/** Nothing in the Library yet: the first recipe comes from a link, text or photos. */
export function LibraryEmpty() {
  const intl = useIntl();

  return (
    <EmptyCard
      description={intl.formatMessage({ id: "recipes.empty.descriptionMobile" })}
      icon="book-outline"
      testID="library-empty"
      title={intl.formatMessage({ id: "recipes.empty.title" })}
    />
  );
}

/** A cookbook with no recipe in it. */
export function CookbookNoRecipes() {
  const intl = useIntl();

  return (
    <View className="pt-[22px]">
      <EmptyCard
        icon="book-outline"
        testID="cookbook-empty"
        title={intl.formatMessage({ id: "recipes.cookbooks.empty" })}
      />
    </View>
  );
}

/** The Cookbooks lens with no cookbook: the way to make the first one. */
export function CookbooksEmpty() {
  const intl = useIntl();
  const router = useRouter();
  const accentText = useAccentTextColor();
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);

  return (
    <View className="bg-surface mx-5 gap-3.5 rounded-3xl p-[18px]" testID="library-cookbooks-empty">
      <View className="flex-row items-center gap-3.5">
        <View className="bg-accent/10 size-12 items-center justify-center rounded-2xl">
          <Ionicons color={accentText} name="book-outline" size={24} />
        </View>
        <Text className="text-foreground min-w-0 flex-1 text-lg font-semibold">
          {intl.formatMessage({ id: "recipes.empty.noCookbooks" })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        className="bg-accent h-11 flex-row items-center justify-center gap-2 rounded-full"
        testID="library-cookbooks-empty-new"
        onPress={() => router.push("/new-cookbook")}
      >
        <Ionicons color={accentForeground} name="add" size={20} />
        <Text className="text-accent-foreground text-[15px] font-semibold">
          {intl.formatMessage({ id: "recipes.cookbooks.createTitle" })}
        </Text>
      </Pressable>
    </View>
  );
}

/** Filters left nothing to show; Clear filters undoes them. */
export function LibraryNoResults({ onClear }: { onClear: () => void }) {
  const intl = useIntl();
  const warning = useThemeColor("warning");
  const warningInk = useWarningInkColor();

  return (
    <View className="bg-surface mx-5 gap-3.5 rounded-3xl p-[18px]" testID="library-no-results">
      <View className="flex-row items-center gap-3.5">
        <View className="bg-warning/20 size-12 items-center justify-center rounded-full">
          <Ionicons color={warning} name="funnel-outline" size={22} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-foreground text-lg font-semibold">
            {intl.formatMessage({ id: "recipes.empty.noResults" })}
          </Text>
          <Text className="text-muted text-[15px] leading-[21px]">
            {intl.formatMessage({ id: "recipes.empty.noResultsHint" })}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        className="bg-warning/20 h-11 flex-row items-center justify-center gap-2 rounded-full"
        testID="library-clear-filters"
        onPress={onClear}
      >
        <Ionicons color={warningInk} name="refresh" size={18} />
        <Text className="text-warning-ink text-[15px] font-medium">
          {intl.formatMessage({ id: "common.filters.clearFilters" })}
        </Text>
      </Pressable>
    </View>
  );
}
