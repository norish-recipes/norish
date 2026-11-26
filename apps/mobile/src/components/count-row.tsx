import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { useTokenColor } from "@/hooks/use-token-color";
import { edgeAt } from "@/lib/card-edges";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton } from "heroui-native";

/** How far each level of a tree sets its rows in, in points. */
const INDENT = 24;

/** A card slice's row for a named entry: its `leading` picture, the name with a `tag`, the muted
 * `count`, and a lock mark (named by `lockLabel`) where it is read-only, else a chevron. A tree's
 * row is set in by its `depth` and may carry a `fold` button before it; `trailing` ends the row
 * in place of the lock or chevron. */
export function CountRow({
  name,
  count,
  countLabel,
  tag,
  leading,
  depth = 0,
  fold,
  trailing,
  struck = false,
  lockLabel,
  testID,
  onPress,
}: {
  name: string;
  count?: string;
  /** What the count counts, for a screen reader, which hears the number alone otherwise. */
  countLabel?: string;
  tag?: ReactNode;
  leading?: ReactNode;
  depth?: number;
  /** Folds the kinds under this entry out or in; `foldable` false leaves an empty cell, no button. */
  fold?: {
    foldable: boolean;
    expanded: boolean;
    label: string;
    testID: string;
    onPress: () => void;
  };
  trailing?: ReactNode;
  /** The name struck through, for an entry about to go. */
  struck?: boolean;
  /** Set where the entry is read-only: the lock mark's accessibility label. */
  lockLabel?: string;
  testID?: string;
  onPress?: () => void;
}) {
  const muted = useTokenColor("muted");
  const content = (
    <>
      {leading}
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <Text
          className={`text-foreground shrink text-base ${struck ? "line-through opacity-60" : ""}`}
          numberOfLines={1}
        >
          {name}
        </Text>
        {tag}
      </View>
      {count ? (
        <Text accessibilityLabel={countLabel} className="text-muted text-base">
          {count}
        </Text>
      ) : null}
      {trailing ??
        (lockLabel ? (
          <View accessibilityLabel={lockLabel} accessibilityRole="image" accessible>
            <Ionicons color={muted} name="lock-closed-outline" size={15} />
          </View>
        ) : onPress ? (
          <Ionicons color={muted} name="chevron-forward" size={16} />
        ) : null)}
    </>
  );
  const className = "min-h-[52px] min-w-0 flex-1 flex-row items-center gap-3 px-4";

  return (
    <View
      className="flex-row items-center"
      style={depth ? { paddingLeft: depth * INDENT } : undefined}
    >
      {fold ? (
        fold.foldable ? (
          <Pressable
            accessibilityLabel={fold.label}
            accessibilityRole="button"
            accessibilityState={{ expanded: fold.expanded }}
            className="w-9 items-center justify-center self-stretch pl-2"
            testID={fold.testID}
            onPress={fold.onPress}
          >
            <Ionicons
              color={muted}
              name={fold.expanded ? "chevron-down" : "chevron-forward"}
              size={16}
            />
          </Pressable>
        ) : (
          <View className="w-9 self-stretch" />
        )
      ) : null}
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          className={className}
          testID={testID}
          onPress={onPress}
        >
          {content}
        </Pressable>
      ) : (
        <View className={className} testID={testID}>
          {content}
        </View>
      )}
    </View>
  );
}

/** A loading row, shaped like a counted row's name. */
export function CountRowSkeleton() {
  return (
    <View className="min-h-[52px] justify-center px-4">
      <Skeleton className="h-4 w-40 rounded-lg" />
    </View>
  );
}

/** A card of loading rows. */
export function CountCardSkeleton({ rows = 6 }: { rows?: number }) {
  return Array.from({ length: rows }, (_, index) => (
    <CardSlice key={index} edge={edgeAt(index, rows)}>
      <CountRowSkeleton />
    </CardSlice>
  ));
}
