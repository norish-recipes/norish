import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Skeleton } from "heroui-native";

import { RoundTick } from "./round-tick";

/** Where a row sits in its group, which rounds the group's first and last row. */
export type PickRowPosition = { first: boolean; last: boolean };

/** A row's classes, for the rows of the list that are not ticks. */
export const pickRowClass = ({ first, last }: PickRowPosition) =>
  `bg-default flex-row items-center gap-3 px-3.5 py-2.5 ${first ? "rounded-t-[22px]" : "border-separator border-t"} ${last ? "rounded-b-[22px]" : ""}`;

/** A row's shell while its content loads: the picture, the name and the tick, in the row's own layout. */
export function PickRowSkeleton({ position }: { position: PickRowPosition }) {
  return (
    <View className={pickRowClass(position)}>
      <Skeleton className="size-11 rounded-xl" />
      <Skeleton className="h-6 flex-1 rounded-md" />
      <Skeleton className="size-[26px] rounded-full" />
    </View>
  );
}

/** One row of a sheet's list of things to tick: a picture, a name and a round tick. */
export function PickRow({
  media,
  title,
  subtitle,
  selected,
  position,
  testID,
  onToggle,
}: {
  /** A 44 pt picture, rounded by the caller. */
  media: ReactNode;
  title: string;
  subtitle?: string;
  selected: boolean;
  position: PickRowPosition;
  testID: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      className={pickRowClass(position)}
      testID={testID}
      onPress={onToggle}
    >
      {media}
      <View className="min-w-0 flex-1">
        <Text
          className={`text-foreground text-base ${subtitle ? "font-semibold" : ""}`}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? <Text className="text-muted text-[13px]">{subtitle}</Text> : null}
      </View>
      <RoundTick selected={selected} sizeClass="size-[26px]" />
    </Pressable>
  );
}
