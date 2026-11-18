import type { TabScroll } from "@/lib/use-tab-scroll";
import type { ReactElement } from "react";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Loader } from "@/components/loader";
import { TabListMarker } from "@/components/tab-list-marker";
import { SCROLLED_PAST } from "@/components/tab-root-header";
import { homeIndicator } from "@/lib/home-indicator";
import { SPRING_FADE_IN, SPRING_FADE_OUT, SPRING_LAYOUT } from "@/lib/motion/layout";
import { closeOpenRow } from "@/lib/open-row";
import { useTabBarMinimised } from "@/lib/tab-accessory-placement";
import { tabListBottomInset } from "@/lib/tab-bar-placement";
import { useIsFocused } from "expo-router";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

import { cardChunks } from "../utils/card-chunks";
import { LOAD_MORE_FOOTER_HEIGHT, loadMoreFooterBox } from "../utils/load-more-footer";

/** The height of the page-coloured fade over a list's end: one height, or one at rest and one once scrolled. */
export type FadeHeight = number | { rest: number; scrolled: number };

/** Cards in a cell, in both views: a card keeps its parent when the view changes, so nothing
 * remounts or enters again, and the others in a cell move when one leaves it. */
const CELL = 8;
// A cell is about the 20 cards a pair-row list rendered: two cells at first, one more with each batch.
const INITIAL_CELLS = 2;
const BATCH_CELLS = 1;

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
  /** `automatic` for the tab's own list, under the bar whose title hides as it scrolls. */
  insets?: "automatic" | "never";
  /** The tab's scroll (`useTabScroll`): the list's handler and the offset. */
  scroll: TabScroll;
  testID?: string;
}) {
  const { offset, onScroll } = scroll;
  const minimised = useTabBarMinimised();
  const fadeStyle = useAnimatedStyle(() => ({
    height:
      typeof fadeHeight === "number"
        ? fadeHeight
        : offset.value > SCROLLED_PAST
          ? fadeHeight.scrolled
          : fadeHeight.rest,
  }));
  const isGrid = variant === "grid";
  const focused = useIsFocused();
  // A card moving cells remounts, entering only if new to `listed`. A change first commits the old
  // cells with only leaving cards set to exit, as Reanimated reads that before the removal.
  const ids = rows.map(rowKey);
  const [drawn, setDrawn] = useState(() => ({ rows, ids, listed: new Set<string>() }));
  const changed = drawn.ids.join("\n") !== ids.join("\n");
  const leaving = new Set(changed ? drawn.ids.filter((id) => !ids.includes(id)) : []);

  useLayoutEffect(() => {
    if (changed) setDrawn({ rows, ids, listed: new Set(drawn.ids) });
  }, [changed, rows, ids, drawn.ids]);

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
      data={cardChunks(changed ? drawn.rows : rows, CELL)}
      initialNumToRender={INITIAL_CELLS}
      itemLayoutAnimation={SPRING_LAYOUT}
      keyExtractor={(_chunk, index) => `cell-${index}`}
      maxToRenderPerBatch={BATCH_CELLS}
      renderItem={({ item: chunk }) => (
        <View className={isGrid ? "flex-row flex-wrap px-3.5" : undefined}>
          {chunk.map((row) => (
            <Animated.View
              key={rowKey(row)}
              className={isGrid ? "w-1/2 flex-row px-1.5 pb-3" : "px-5 pb-3"}
              entering={drawn.listed.has(rowKey(row)) ? undefined : SPRING_FADE_IN}
              exiting={leaving.has(rowKey(row)) ? SPRING_FADE_OUT : undefined}
              layout={SPRING_LAYOUT}
            >
              {renderCard(row)}
            </Animated.View>
          ))}
        </View>
      )}
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
      {/* The tab's own list, which the bar's title and the accessory follow. */}
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
