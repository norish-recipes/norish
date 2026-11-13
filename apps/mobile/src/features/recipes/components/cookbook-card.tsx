import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useServerUrl } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { formatMinutesHM, isAllergenTag } from "@norish/shared/lib/helpers";

import { Pill } from "./pill";

/** A cookbook's cover: its own photo, else a mosaic of up to four members' photos. */
function CookbookCover({
  cookbook,
  className,
}: {
  cookbook: CookbookSummaryDTO;
  className: string;
}) {
  const toUrl = useServerUrl();
  const [muted] = useThemeColor(["muted"] as const);
  const photos = cookbook.image ? [cookbook.image] : cookbook.coverImages.slice(0, 4);
  const tile = (uri: string, tileClass: string) => (
    <Image key={uri} className={`bg-default ${tileClass}`} source={{ uri: toUrl(uri) }} />
  );

  if (photos.length === 0) {
    return (
      <View className={`bg-default items-center justify-center ${className}`}>
        <Ionicons color={muted} name="book-outline" size={26} />
      </View>
    );
  }

  // The board's mosaic: one photo whole, two side by side, three as one tall and two stacked, four in a grid.
  const columns =
    photos.length >= 4
      ? [
          [0, 2],
          [1, 3],
        ]
      : photos.length === 3
        ? [[0], [1, 2]]
        : photos.map((_, index) => [index]);

  return (
    <View className={`flex-row gap-0.5 overflow-hidden ${className}`}>
      {columns.map((rows) => (
        <View key={rows.join()} className="flex-1 gap-0.5">
          {rows.map((index) => tile(photos[index] ?? "", "w-full flex-1"))}
        </View>
      ))}
    </View>
  );
}

/** A cookbook in the Library, as a row or a grid card; opening it arrives with the Cookbooks ticket. */
export function CookbookCard({
  cookbook,
  variant,
  allergies,
}: {
  cookbook: CookbookSummaryDTO;
  variant: RecipeViewMode;
  allergies: string[];
}) {
  const intl = useIntl();
  const [accent] = useThemeColor(["accent"] as const);
  const allergySet = new Set(allergies.map((allergy) => allergy.toLowerCase()));
  const allergens = cookbook.memberTags.filter((tag) => isAllergenTag(tag, allergySet));
  const timeLabel = formatMinutesHM(cookbook.totalMinutes ?? undefined);
  const count = intl.formatMessage(
    { id: "recipes.cookbooks.recipeCount" },
    { count: cookbook.memberCount }
  );
  const description = cookbook.memberTitles.join(", ");
  const size = variant === "grid" ? "foot" : "row";

  const facts = (
    <View className="flex-row gap-1.5 overflow-hidden">
      <Pill size={size}>{count}</Pill>
      {timeLabel ? (
        <Pill icon="time-outline" size={size}>
          {timeLabel}
        </Pill>
      ) : null}
      {cookbook.minServings ? (
        <Pill icon="people-outline" size={size}>
          {cookbook.minServings}
        </Pill>
      ) : null}
      {allergens.length > 0 ? (
        <Pill icon="warning-outline" size={size} tone="warning">
          {allergens.length === 1 ? (allergens[0] ?? "") : `+${allergens.length}`}
        </Pill>
      ) : null}
    </View>
  );

  const title = (
    <View className="min-w-0 flex-row items-center gap-1.5">
      <Ionicons color={accent} name="book-outline" size={16} />
      <Text className="text-foreground min-w-0 flex-1 text-base font-semibold" numberOfLines={1}>
        {cookbook.title}
      </Text>
    </View>
  );

  return variant === "grid" ? (
    <Pressable
      accessibilityRole="button"
      className="bg-surface border-border h-[286px] flex-1 overflow-hidden rounded-3xl border"
      testID={`cookbook-card-${cookbook.id}`}
    >
      <CookbookCover className="h-40 w-full" cookbook={cookbook} />
      <View className="min-h-0 flex-1 gap-0.5 px-3 pt-2.5 pb-3">
        {title}
        <Text className="text-muted text-xs" numberOfLines={1}>
          {description}
        </Text>
        <View className="border-border mt-auto border-t pt-2.5">{facts}</View>
      </View>
    </Pressable>
  ) : (
    <Pressable
      accessibilityRole="button"
      className="bg-surface h-[116px] flex-row overflow-hidden rounded-[20px]"
      testID={`cookbook-card-${cookbook.id}`}
    >
      <CookbookCover className="h-[116px] w-[108px]" cookbook={cookbook} />
      <View className="min-w-0 flex-1 gap-[3px] px-3.5 py-3">
        {title}
        <Text className="text-muted text-sm" numberOfLines={1}>
          {description}
        </Text>
        <View className="mt-auto">{facts}</View>
      </View>
    </Pressable>
  );
}
