import type { ReactElement } from "react";
import React, { Fragment, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabListBottomInset } from "@/components/tab-list-inset";
import { sprung } from "@/lib/motion/spring";
import { closeOpenRow } from "@/lib/open-row";
import { useIsFocused } from "expo-router";
import { Spinner } from "heroui-native";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

import { cardLines } from "../utils/card-lines";

/** The height of the page-coloured fade over a list's end: one height, or one at rest and one once scrolled. */
export type FadeHeight = number | { rest: number; scrolled: number };

/** The Library's cards, a row each or two to a row, paged on scroll; `header` scrolls with them,
 * `empty` shows when there is no card. A grid's pairs are single-column lines, so the list stays
 * one list across views: its header keeps its state and the lines animate in, out and on reorder. */
export function CardList<Row>({
  rows,
  variant,
  header,
  empty,
  isFetchingNextPage,
  rowKey,
  renderCard,
  onEndReached,
  fadeHeight,
  testID,
}: {
  rows: Row[];
  variant: RecipeViewMode;
  header: ReactElement;
  empty: ReactElement;
  isFetchingNextPage: boolean;
  rowKey: (row: Row) => string;
  renderCard: (row: Row) => ReactElement;
  onEndReached: () => void;
  fadeHeight: FadeHeight;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const [scrolled, setScrolled] = useState(false);
  const isGrid = variant === "grid";
  const focused = useIsFocused();

  // Leaving the screen, for another tab or a sheet over it, closes the open row.
  useEffect(() => {
    if (!focused) closeOpenRow();
  }, [focused]);

  return (
    // A touch that no row took closes the open one.
    <View className="flex-1" onTouchStart={() => closeOpenRow()}>
      <Animated.FlatList
        ListEmptyComponent={empty}
        ListFooterComponent={isFetchingNextPage ? <Spinner className="py-4" /> : undefined}
        ListHeaderComponent={header}
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: tabListBottomInset(insets.bottom),
        }}
        contentInsetAdjustmentBehavior="never"
        data={cardLines(rows, isGrid ? 2 : 1)}
        itemLayoutAnimation={sprung(LinearTransition.springify())}
        keyExtractor={(line) => line.map(rowKey).join("|")}
        renderItem={({ item: line }) => (
          <Animated.View
            className={isGrid ? "mb-3 flex-row gap-3 px-5" : "px-5 pb-3"}
            entering={sprung(FadeIn.springify())}
            exiting={sprung(FadeOut.springify())}
          >
            {line.map((row) => (
              <Fragment key={rowKey(row)}>{renderCard(row)}</Fragment>
            ))}
            {/* A grid's last card keeps its half of the line. */}
            {isGrid && line.length === 1 ? <View className="flex-1" /> : null}
          </Animated.View>
        )}
        scrollEventThrottle={32}
        testID={testID}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > 8)}
        onScrollBeginDrag={() => closeOpenRow()}
      />
      {/* Cards dissolve into the page colour before the tab bar. */}
      <View
        className="to-background from-background/0 absolute inset-x-0 bottom-0 bg-linear-to-b to-75%"
        pointerEvents="none"
        style={{
          height:
            typeof fadeHeight === "number"
              ? fadeHeight
              : scrolled
                ? fadeHeight.scrolled
                : fadeHeight.rest,
        }}
      />
    </View>
  );
}
