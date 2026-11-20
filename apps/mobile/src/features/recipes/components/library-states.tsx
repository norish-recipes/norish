import React from "react";
import { Pressable, Text, View } from "react-native";
import { EmptyCard } from "@/components/empty-card";
import { NoResultsCard } from "@/components/no-results-card";
import { TAB_ROUTES } from "@/lib/tab-routes";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

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
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);

  return (
    <EmptyCard
      icon="book-outline"
      testID="library-cookbooks-empty"
      title={intl.formatMessage({ id: "recipes.empty.noCookbooks" })}
    >
      <Pressable
        accessibilityRole="button"
        className="bg-accent h-11 flex-row items-center justify-center gap-2 rounded-full"
        testID="library-cookbooks-empty-new"
        onPress={() => router.push(TAB_ROUTES.recipes.newCookbook)}
      >
        <Ionicons color={accentForeground} name="add" size={20} />
        <Text className="text-accent-foreground text-[15px] font-semibold">
          {intl.formatMessage({ id: "recipes.cookbooks.createTitle" })}
        </Text>
      </Pressable>
    </EmptyCard>
  );
}

/** Filters left nothing to show; Clear filters undoes them. */
export function LibraryNoResults({ onClear }: { onClear: () => void }) {
  const intl = useIntl();

  return (
    <NoResultsCard
      action={{
        label: intl.formatMessage({ id: "common.filters.clearFilters" }),
        icon: "refresh",
        testID: "library-clear-filters",
        onPress: onClear,
      }}
      description={intl.formatMessage({ id: "recipes.empty.noResultsHint" })}
      icon="funnel-outline"
      testID="library-no-results"
    />
  );
}
