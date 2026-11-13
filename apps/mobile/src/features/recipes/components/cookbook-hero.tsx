import React from "react";
import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import { CookbookCover } from "./cookbook-cover";

/** The cover's last 58% fades into the page, so the title sits on the ground. */
function CoverFade() {
  const [background] = useThemeColor(["background"] as const);

  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient id="cookbook-cover-fade" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0.42" stopColor={background} stopOpacity={0} />
            <Stop offset="1" stopColor={background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#cookbook-cover-fade)" height="100%" width="100%" />
      </Svg>
    </View>
  );
}

/** A cookbook page's top: its cover under the transparent header, then its title over its recipe count. */
export function CookbookHero({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const intl = useIntl();

  return (
    <View testID="cookbook-hero">
      <View className="h-[300px]">
        <CookbookCover className="h-[300px] w-full pb-10" cookbook={cookbook} iconSize={56} />
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
