import type { RowPosition } from "@/components/slice-row";
import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SliceHairline, sliceRowClass } from "@/components/slice-row";
import { Tick } from "@/components/tick";
import { Skeleton } from "heroui-native";

/** A row's shell while its content loads: the picture, the name and the tick, in the row's own layout. */
export function PickRowSkeleton({ position }: { position: RowPosition }) {
  return (
    <View className={sliceRowClass(position, true)}>
      <SliceHairline tall first={position.first} />
      <Skeleton className="size-10 rounded-xl" />
      <Skeleton className="h-6 flex-1 rounded-md" />
      <Skeleton className="size-6 rounded-full" />
    </View>
  );
}

/** One row of a sheet's list: a picture, a name and a round tick, or a `trailing` node and no press. */
export function PickRow({
  media,
  title,
  subtitle,
  selected = false,
  position,
  testID,
  trailing,
  onToggle,
}: {
  /** A 40 pt picture, rounded by the caller. */
  media: ReactNode;
  title: string;
  subtitle?: string;
  selected?: boolean;
  position: RowPosition;
  testID: string;
  /** Replaces the tick; give it with no `onToggle` for a row that does not tick. */
  trailing?: ReactNode;
  onToggle?: () => void;
}) {
  const className = sliceRowClass(position, true);
  const content = (
    <>
      <SliceHairline tall first={position.first} />
      {media}
      <View className="min-w-0 flex-1 gap-px">
        <Text className="text-foreground text-base" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text className="text-muted text-sm">{subtitle}</Text> : null}
      </View>
      {trailing ?? <Tick selected={selected} />}
    </>
  );

  return onToggle ? (
    <Pressable
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      className={className}
      testID={testID}
      onPress={onToggle}
    >
      {content}
    </Pressable>
  ) : (
    <View className={className} testID={testID}>
      {content}
    </View>
  );
}
