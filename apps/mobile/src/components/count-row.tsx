import type { MenuItem } from "@/components/native-menu";
import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { NativeMenu } from "@/components/native-menu";
import { useOnSheet } from "@/components/on-sheet";
import { Pill } from "@/components/pill";
import { useTokenColor } from "@/hooks/use-token-color";
import { edgeAt } from "@/lib/card-edges";
import { spokenLabel } from "@/lib/spoken-label";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton } from "heroui-native";

/** A row's height. */
const ROW_HEIGHT = "min-h-[52px]";

/** How far each level of a tree sets its rows in, in points. */
const INDENT = 24;

/** A card slice's row for a named entry: picture, name, tag, count, a lock (read-only) or a chevron
 * (opens), then a `trailing` control beside its press. A tree's entry sets in by `depth`, may `fold`. */
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
  menu = [],
  testID,
  onPress,
}: {
  name: string;
  count?: string;
  /** What the count counts, for a screen reader, which hears the number alone otherwise. */
  countLabel?: string;
  /** A warning tag after the name, such as a flag. */
  tag?: string;
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
  /** A long-press menu over the row, which then takes the tap as `onPress`; none, no menu. */
  menu?: MenuItem[];
  testID?: string;
  onPress?: () => void;
}) {
  const muted = useTokenColor("muted");
  const ground = useOnSheet() ? "bg-sand" : "bg-surface";
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
        {tag ? (
          <Pill size="tag" tone="warning">
            {tag}
          </Pill>
        ) : null}
      </View>
      {count ? (
        <Text accessibilityLabel={countLabel} className="text-muted text-base">
          {count}
        </Text>
      ) : null}
      {lockLabel ? (
        <View accessibilityLabel={lockLabel} accessibilityRole="image" accessible>
          <Ionicons color={muted} name="lock-closed-outline" size={15} />
        </View>
      ) : onPress ? (
        <Ionicons color={muted} name="chevron-forward" size={16} />
      ) : null}
    </>
  );
  // Spoken as one: iOS would otherwise join every child's label, empty ones too.
  const spoken = spokenLabel(name, tag, countLabel ?? count, lockLabel);
  const row = `${ROW_HEIGHT} flex-row items-center gap-3 px-4`;
  const className = `${row} min-w-0 flex-1`;

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
      {onPress && menu.length > 0 ? (
        <NativeMenu
          fill
          items={menu}
          label={spokenLabel(name, tag)}
          testID={testID ?? name}
          value={spokenLabel(countLabel ?? count, lockLabel) || undefined}
          onPress={onPress}
        >
          {/* Opaque, as the long press lifts a snapshot of the whole row. */}
          <View className={`${ground} ${row}`}>{content}</View>
        </NativeMenu>
      ) : onPress ? (
        <Pressable
          accessibilityLabel={spoken}
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
      {/* Beside the row's button: inside it, the control would share its press and its label. */}
      {trailing ? <View className="pr-4">{trailing}</View> : null}
    </View>
  );
}

/** A loading row, shaped like a counted row's name. */
export function CountRowSkeleton() {
  return (
    <View className={`${ROW_HEIGHT} justify-center px-4`}>
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
