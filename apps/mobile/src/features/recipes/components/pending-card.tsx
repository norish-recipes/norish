import React from "react";
import { Text, View } from "react-native";
import { ImportSpinner } from "@/features/recipes/components/import-spinner";
import { hostOf, isWebLink, plainLink } from "@/lib/network/host-of";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

/** A running import as a card: the link's host, and placeholders where its facts will go. */
export function PendingCard({
  id,
  url,
  variant,
}: {
  id: string;
  url: string | undefined;
  variant: RecipeViewMode;
}) {
  const intl = useIntl();
  // Text and photo imports carry a label such as "[pasted]", not a link.
  const host = url && isWebLink(url) ? plainLink(hostOf(url)) : "";
  const title = intl.formatMessage({ id: "recipes.dashboard.importingCard" });

  const isGrid = variant === "grid";
  const copy = (
    <>
      <Text
        className={`text-foreground font-semibold ${isGrid ? "text-sm" : "text-base"}`}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text className={`text-muted ${isGrid ? "text-xs" : "text-sm"}`} numberOfLines={1}>
        {host}
      </Text>
    </>
  );

  return isGrid ? (
    <View
      accessible
      accessibilityLabel={`${title} ${host}`}
      className="bg-surface border-border h-[286px] flex-1 overflow-hidden rounded-3xl border"
      testID={`pending-card-${id}`}
    >
      <View className="bg-default h-40 items-center justify-center">
        <ImportSpinner size={30} />
      </View>
      <View className="flex-1 gap-0.5 px-3 pt-2.5 pb-3">
        {copy}
        <View className="border-border mt-auto flex-row gap-1 border-t pt-2.5">
          <Skeleton className="h-[22px] w-11 rounded-[11px]" />
          <Skeleton className="h-[22px] w-[34px] rounded-[11px]" />
        </View>
      </View>
    </View>
  ) : (
    <View
      accessible
      accessibilityLabel={`${title} ${host}`}
      className="bg-surface h-[116px] flex-row overflow-hidden rounded-[20px]"
      testID={`pending-card-${id}`}
    >
      <View className="bg-default h-[116px] w-[108px] items-center justify-center">
        <ImportSpinner size={28} />
      </View>
      <View className="min-w-0 flex-1 gap-[3px] px-3.5 py-3">
        {copy}
        <View className="mt-auto flex-row gap-1.5">
          <Skeleton className="h-6 w-[52px] rounded-xl" />
          <Skeleton className="h-6 w-10 rounded-xl" />
          <Skeleton className="h-6 w-[76px] rounded-xl" />
        </View>
      </View>
    </View>
  );
}
