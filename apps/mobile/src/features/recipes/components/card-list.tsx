import type { TabScroll } from "@/lib/use-tab-scroll";
import type { ReactElement } from "react";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Loader } from "@/components/loader";
import { TabListMarker } from "@/components/tab-list-marker";
import { SPRING_FADE_IN, SPRING_FADE_OUT, SPRING_LAYOUT } from "@/lib/motion/layout";
import { closeOpenRow } from "@/lib/open-row";
import { tabListBottomInset } from "@/lib/tab-bar-placement";
import { useIsFocused } from "expo-router";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

import { cardChunks } from "../utils/card-chunks";
import { LOAD_MORE_FOOTER_HEIGHT, loadMoreFooterBox } from "../utils/load-more-footer";

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
  insets = "never",
  scroll,
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
  /** `automatic` under a native large title, which the list scrolls with. */
  insets?: "automatic" | "never";
  /** The tab's scroll (`useTabScroll`): the list's handler, the tab bar's guess and the offset. */
  scroll: TabScroll;
  testID?: string;
}) {
  const { minimised, homeIndicator, offset, onScroll } = scroll;
  const fadeStyle = useAnimatedStyle(() => ({
    height:
      typeof fadeHeight === "number"
        ? fadeHeight
        : offset.value > 8
          ? fadeHeight.scrolled
          : fadeHeight.rest,
  }));
  const isGrid = variant === "grid";
  const focused = useIsFocused();

  // Leaving the screen, for another tab or a sheet over it, closes the open row.
  useEffect(() => {
    if (!focused) closeOpenRow();
  }, [focused]);

  const list = (
    <Animated.FlatList
      ListEmptyComponent={empty}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ height: LOAD_MORE_FOOTER_HEIGHT }}>
            {/* From the last card down to the accessory's top, over the end padding below the strip. */}
            <View
              className="absolute inset-x-0"
              style={loadMoreFooterBox(homeIndicator, minimised)}
            >
              <Loader centred />
            </View>
          </View>
        ) : undefined
      }
      ListHeaderComponent={header}
      className="flex-1"
      contentContainerStyle={{
        paddingBottom: tabListBottomInset(homeIndicator),
      }}
      contentInsetAdjustmentBehavior={insets}
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
          <Animated.View className="px-5 pb-3" entering={SPRING_FADE_IN} exiting={SPRING_FADE_OUT}>
            {chunk[0] ? renderCard(chunk[0]) : null}
          </Animated.View>
        )
      }
      scrollEventThrottle={16}
      testID={testID}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      onScroll={onScroll}
      onScrollBeginDrag={() => closeOpenRow()}
    />
  );

  return (
    // A touch that no row took closes the open one.
    <View className="flex-1" onTouchStart={() => closeOpenRow()}>
      {/* Under a native large title the list is the tab's, which the bar's title and accessory follow. */}
      {insets === "automatic" ? <TabListMarker>{list}</TabListMarker> : list}
      {/* Cards dissolve into the page colour before the tab bar. */}
      <Animated.View
        className="to-background from-background/0 absolute inset-x-0 bottom-0 bg-linear-to-b to-75%"
        pointerEvents="none"
        style={fadeStyle}
      />
    </View>
  );
}
