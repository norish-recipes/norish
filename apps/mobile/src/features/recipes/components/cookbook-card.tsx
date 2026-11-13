import React from "react";
import { Image, Text, View } from "react-native";
import { GestureDetector, useTapGesture } from "react-native-gesture-handler";
import { useServerUrl } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { coverMosaicColumns } from "@norish/shared-react/recipes";
import { allergenSet, formatMinutesHM, isAllergenTag } from "@norish/shared/lib/helpers";

import type { CardActions } from "../hooks/use-card-actions";
import type { MenuItem } from "./card-menu";
import { cookbookMenuActions } from "../utils/card-actions";
import { CardMenu } from "./card-menu";
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

  return (
    <View className={`flex-row gap-0.5 overflow-hidden ${className}`}>
      {coverMosaicColumns(photos.length).map((rows) => (
        <View key={rows.join()} className="flex-1 gap-0.5">
          {rows.map((index) => tile(photos[index] ?? "", "w-full flex-1"))}
        </View>
      ))}
    </View>
  );
}

/** A cookbook in the Library, as a row or a grid card; a long press offers Add recipes, Rename and Delete. */
export function CookbookCard({
  cookbook,
  variant,
  allergies,
  actions,
}: {
  cookbook: CookbookSummaryDTO;
  variant: RecipeViewMode;
  allergies: string[];
  actions: CardActions;
}) {
  const intl = useIntl();
  const router = useRouter();
  const [accent] = useThemeColor(["accent"] as const);
  const allergySet = allergenSet(allergies);
  const allergens = cookbook.memberTags.filter((tag) => isAllergenTag(tag, allergySet));
  const timeLabel = formatMinutesHM(cookbook.totalMinutes ?? undefined);
  const count = intl.formatMessage(
    { id: "recipes.cookbooks.recipeCount" },
    { count: cookbook.memberCount }
  );
  const description = cookbook.memberTitles.join(", ");
  const size = variant === "grid" ? "footer" : "row";

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

  const labels = {
    addRecipes: intl.formatMessage({ id: "recipes.cookbooks.addRecipes" }),
    rename: intl.formatMessage({ id: "recipes.cookbooks.rename" }),
    delete: intl.formatMessage({ id: "recipes.actions.delete" }),
  };
  const runs = {
    addRecipes: () => actions.addRecipes(cookbook),
    rename: () => actions.renameCookbook(cookbook),
    delete: () => actions.deleteCookbook(cookbook),
  };
  const icons: Record<keyof typeof runs, MenuItem["icon"]> = {
    addRecipes: "plus",
    rename: "pencil",
    delete: "trash",
  };
  const menu: MenuItem[] = cookbookMenuActions({
    canEdit: actions.canEditCookbook(cookbook),
    canDelete: actions.canDeleteCookbook(cookbook),
  }).map((key) => ({
    key,
    label: labels[key],
    icon: icons[key],
    destructive: key === "delete",
    onPress: runs[key],
  }));
  const open = () => router.push({ pathname: "/cookbook/[id]", params: { id: cookbook.id } });
  const tap = useTapGesture({ runOnJS: true, onActivate: open });

  return (
    <CardMenu href={{ pathname: "/cookbook/[id]", params: { id: cookbook.id } }} items={menu}>
      <View
        accessible
        accessibilityActions={menu.map(({ key, label }) => ({ name: key, label }))}
        accessibilityLabel={cookbook.title}
        accessibilityRole="button"
        className={variant === "grid" ? "flex-1" : undefined}
        testID={`cookbook-card-${cookbook.id}`}
        onAccessibilityAction={({ nativeEvent }) =>
          runs[nativeEvent.actionName as keyof typeof runs]?.()
        }
        onAccessibilityTap={open}
      >
        <GestureDetector gesture={tap}>
          {variant === "grid" ? (
            <View className="bg-surface border-border h-[286px] overflow-hidden rounded-3xl border">
              <CookbookCover className="h-40 w-full" cookbook={cookbook} />
              <View className="min-h-0 flex-1 gap-0.5 px-3 pt-2.5 pb-3">
                {title}
                <Text className="text-muted text-xs" numberOfLines={1}>
                  {description}
                </Text>
                <View className="border-border mt-auto border-t pt-2.5">{facts}</View>
              </View>
            </View>
          ) : (
            <View className="bg-surface h-[116px] flex-row overflow-hidden rounded-[20px]">
              <CookbookCover className="h-[116px] w-[108px]" cookbook={cookbook} />
              <View className="min-w-0 flex-1 gap-[3px] px-3.5 py-3">
                {title}
                <Text className="text-muted text-sm" numberOfLines={1}>
                  {description}
                </Text>
                <View className="mt-auto">{facts}</View>
              </View>
            </View>
          )}
        </GestureDetector>
      </View>
    </CardMenu>
  );
}
