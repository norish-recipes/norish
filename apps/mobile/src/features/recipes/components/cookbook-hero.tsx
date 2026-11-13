import React from "react";
import { Text, View } from "react-native";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import { CookbookCover } from "./cookbook-cover";

const FADE_BANDS = Array.from({ length: 29 }, (_, band) => (band + 1) / 29);

/** The cover's last 58% fades into the page, so the title sits on the ground: bands of rising opacity. */
function CoverFade() {
  return (
    <View className="absolute inset-x-0 bottom-0 h-[174px]" pointerEvents="none">
      {FADE_BANDS.map((opacity) => (
        <View key={opacity} className="bg-background flex-1" style={{ opacity }} />
      ))}
    </View>
  );
}

/** A cookbook page's top: its cover under the transparent header, then its title over its recipe count. */
export function CookbookHero({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const intl = useIntl();
  const hasPhotos = cookbook.image !== null || cookbook.coverImages.length > 0;

  return (
    <View testID="cookbook-hero">
      <View className="h-[300px]">
        <CookbookCover
          className={`h-[300px] w-full ${hasPhotos ? "" : "pb-10"}`}
          cookbook={cookbook}
          iconSize={56}
        />
        <CoverFade />
      </View>
      <View className="-mt-[46px] items-center gap-1 px-5">
        <Text
          accessibilityRole="header"
          className="text-foreground text-center text-[32px] leading-[38px] font-semibold tracking-[-0.7px]"
          testID="cookbook-title"
        >
          {cookbook.title}
        </Text>
        <Text className="text-muted text-[15px]" testID="cookbook-count">
          {intl.formatMessage(
            { id: "recipes.cookbooks.recipeCount" },
            { count: cookbook.memberCount }
          )}
        </Text>
      </View>
    </View>
  );
}

/** The hero's shell while the cookbook loads: the cover's ground, the title and the count as bars. */
export function CookbookHeroSkeleton() {
  return (
    <View testID="cookbook-hero-skeleton">
      <Skeleton className="h-[300px] w-full rounded-none" />
      <View className="-mt-[46px] items-center gap-2 px-5">
        <Skeleton className="h-[38px] w-60 rounded-lg" />
        <Skeleton className="h-[18px] w-20 rounded-md" />
      </View>
    </View>
  );
}
