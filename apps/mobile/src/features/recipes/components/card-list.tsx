import type { ReactElement } from "react";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabListBottomInset } from "@/components/tab-list-inset";
import { sprung } from "@/lib/motion/spring";
import { closeOpenRow } from "@/lib/open-row";
import { useIsFocused } from "expo-router";
import { Spinner } from "heroui-native";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

import { cardChunks } from "../utils/card-chunks";

/** The height of the page-coloured fade over a list's end: one height, or one at rest and one once scrolled. */
export type FadeHeight = number | { rest: number; scrolled: number };

/** How many cards a grid cell holds: they wrap two to a line inside it and reorder there, so a card
 * leaving moves the others in its cell; only a card crossing into the next cell is drawn anew. */
const GRID_CELL = 8;
// A cell is 8 cards where a list row is one, so the grid mounts about the 20 cards a pair-row
// list did: two cells at first, one more with each batch.
const GRID_INITIAL_CELLS = 2;
const GRID_BATCH_CELLS = 1;
const LIST_BATCH = 10;

/** The Library's cards, a row each or two to a row, paged on scroll; `header` scrolls with them,
 * `empty` shows when there is no card. It is one list in both views, so its header keeps its state,
 * and a card entering or leaving animates the others into place. */
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
        initialNumToRender={isGrid ? GRID_INITIAL_CELLS : LIST_BATCH}
        data={cardChunks(rows, isGrid ? GRID_CELL : 1)}
        itemLayoutAnimation={sprung(LinearTransition.springify())}
        keyExtractor={(chunk, index) => (isGrid ? `grid-${index}` : rowKey(chunk[0] as Row))}
        maxToRenderPerBatch={isGrid ? GRID_BATCH_CELLS : LIST_BATCH}
        renderItem={({ item: chunk }) =>
          isGrid ? (
            <View className="flex-row flex-wrap px-3.5">
              {chunk.map((row) => (
                <Animated.View
                  key={rowKey(row)}
                  className="w-1/2 flex-row px-1.5 pb-3"
                  entering={sprung(FadeIn.springify())}
                  exiting={sprung(FadeOut.springify())}
                  layout={sprung(LinearTransition.springify())}
                >
                  {renderCard(row)}
                </Animated.View>
              ))}
            </View>
          ) : (
            <Animated.View
              className="px-5 pb-3"
              entering={sprung(FadeIn.springify())}
              exiting={sprung(FadeOut.springify())}
            >
              {chunk[0] ? renderCard(chunk[0]) : null}
            </Animated.View>
          )
        }
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
