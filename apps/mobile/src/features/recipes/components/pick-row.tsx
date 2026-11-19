import type { RowPosition } from "@/components/slice-row";
import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SliceHairline, sliceRowClass } from "@/components/slice-row";
import { Tick } from "@/components/tick";
import { Skeleton } from "heroui-native";

/** A pick row's classes, for the rows of the list that are not ticks. */
export const pickRowClass = (position: RowPosition) => sliceRowClass(position, true);

/** A row's shell while its content loads: the picture, the name and the tick, in the row's own layout. */
export function PickRowSkeleton({ position }: { position: RowPosition }) {
  return (
    <View className={pickRowClass(position)}>
      <SliceHairline first={position.first} tall />
      <Skeleton className="size-10 rounded-xl" />
      <Skeleton className="h-6 flex-1 rounded-md" />
      <Skeleton className="size-6 rounded-full" />
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
  /** A 40 pt picture, rounded by the caller. */
  media: ReactNode;
  title: string;
  subtitle?: string;
  selected: boolean;
  position: RowPosition;
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
      <SliceHairline first={position.first} tall />
      {media}
      <View className="min-w-0 flex-1 gap-px">
        <Text className="text-foreground text-base" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text className="text-muted text-sm">{subtitle}</Text> : null}
      </View>
      <Tick selected={selected} />
    </Pressable>
  );
}
