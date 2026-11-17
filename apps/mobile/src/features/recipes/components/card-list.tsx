import type { ReactElement } from "react";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Loader } from "@/components/loader";
import { tabListBottomInset } from "@/components/tab-list-inset";
import { SPRING_FADE_IN, SPRING_FADE_OUT, SPRING_LAYOUT } from "@/lib/motion/layout";
import { closeOpenRow } from "@/lib/open-row";
import { useIsFocused } from "expo-router";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

import { cardChunks } from "../utils/card-chunks";
import {
  LOAD_MORE_FOOTER_HEIGHT,
  loadMoreFooterSpan,
  nextTabBarMinimised,
} from "../utils/load-more-footer";

/** The height of the page-coloured fade over a list's end: one height, or one at rest and one once scrolled. */
export type FadeHeight = number | { rest: number; scrolled: number };

/** Cards in a grid cell, wrapped two to a line: the others in a cell move when one leaves it. */
const GRID_CELL = 8;
// A cell is 8 cards where a list row is one, so the grid mounts about the 20 cards a pair-row
// list did: two cells at first, one more with each batch.
const GRID_INITIAL_CELLS = 2;
const GRID_BATCH_CELLS = 1;
const LIST_BATCH = 10;

/** The Library's cards in one list for both views, so `header` keeps its state; `empty` shows when
 * there is no card, and a card entering or leaving animates the others into place. */
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
  const [minimised, setMinimised] = useState(false);
  const lastOffsetRef = useRef(0);
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
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ height: LOAD_MORE_FOOTER_HEIGHT }}>
              {/* Spans down to the accessory's top, over the empty clearance below the strip. */}
              <View
                className="absolute inset-x-0 top-0"
                style={{ height: loadMoreFooterSpan(insets.bottom, minimised) }}
              >
                <Loader centred />
              </View>
            </View>
          ) : undefined
        }
        ListHeaderComponent={header}
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: tabListBottomInset(insets.bottom),
        }}
        contentInsetAdjustmentBehavior="never"
        data={cardChunks(rows, isGrid ? GRID_CELL : 1)}
        initialNumToRender={isGrid ? GRID_INITIAL_CELLS : LIST_BATCH}
        itemLayoutAnimation={SPRING_LAYOUT}
        keyExtractor={(chunk, index) => (isGrid ? `grid-${index}` : rowKey(chunk[0] as Row))}
        maxToRenderPerBatch={isGrid ? GRID_BATCH_CELLS : LIST_BATCH}
        renderItem={({ item: chunk }) =>
          isGrid ? (
            <View className="flex-row flex-wrap px-3.5">
              {chunk.map((row) => (
                <Animated.View
                  key={rowKey(row)}
                  className="w-1/2 flex-row px-1.5 pb-3"
                  entering={SPRING_FADE_IN}
                  exiting={SPRING_FADE_OUT}
                  layout={SPRING_LAYOUT}
                >
                  {renderCard(row)}
                </Animated.View>
              ))}
            </View>
          ) : (
            <Animated.View
              className="px-5 pb-3"
              entering={SPRING_FADE_IN}
              exiting={SPRING_FADE_OUT}
            >
              {chunk[0] ? renderCard(chunk[0]) : null}
            </Animated.View>
          )
        }
        scrollEventThrottle={32}
        testID={testID}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        onScroll={(event) => {
          const offset = event.nativeEvent.contentOffset.y;

          setScrolled(offset > 8);
          setMinimised(nextTabBarMinimised(minimised, offset, lastOffsetRef.current));
          lastOffsetRef.current = offset;
        }}
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
