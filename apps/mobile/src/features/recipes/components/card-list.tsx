import type { TabScroll } from "@/lib/use-tab-scroll";
import type { FlashListRef } from "@shopify/flash-list";
import type { ReactElement, Ref } from "react";
import type { ScrollViewProps } from "react-native";
import type { AnimatedRef } from "react-native-reanimated";
import React, { createContext, use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from "react-native-reanimated";
import { Loader } from "@/components/loader";
import { TabListMarker } from "@/components/tab-list-marker";
import { SCROLLED_PAST } from "@/components/tab-root-header";
import { homeIndicator } from "@/lib/home-indicator";
import { closeOpenRow } from "@/lib/open-row";
import { useTabBarMinimised } from "@/lib/tab-accessory-placement";
import { tabListBottomInset } from "@/lib/tab-bar-placement";
import { FlashList } from "@shopify/flash-list";
import { useIsFocused } from "expo-router";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

import { LOAD_MORE_FOOTER_HEIGHT, loadMoreFooterBox } from "../utils/load-more-footer";

/** The height of the page-coloured fade over a list's end: one height, or one at rest and one once scrolled. */
export type FadeHeight = number | { rest: number; scrolled: number };

// The grid's outer edge and the gap between its two columns.
const GRID_EDGE = 20;
const GRID_GAP = 12;

type ScrollRefs = { animated: AnimatedRef<Animated.ScrollView>; marked: boolean };
const ScrollRefsContext = createContext<ScrollRefs | null>(null);

/** The list's scroll view: Reanimated's, so the tab's offset reads on the UI thread, and handed to the
 * tab bar directly, as FlashList wraps it in a View the marker would not see through. */
function TabScrollView({ ref, ...props }: ScrollViewProps & { ref?: Ref<Animated.ScrollView> }) {
  const refs = use(ScrollRefsContext);
  const attach = (node: Animated.ScrollView | null) => {
    refs?.animated(node);
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: Animated.ScrollView | null }).current = node;
  };
  const scroller = <Animated.ScrollView {...props} ref={attach} />;

  return refs?.marked ? <TabListMarker>{scroller}</TabListMarker> : scroller;
}

/**
 * The Library's cards in one recycling list for both views, so `header` keeps its state and only the
 * cards on screen are mounted; `empty` shows when there is no card. A deleted card plays its own
 * leave (`SwipeActions`), and the rest close the gap at once, as on web.
 */
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
  /** The tab's scroll (`useTabScroll`): the offset the bar's title follows. */
  scroll: TabScroll;
  testID?: string;
}) {
  const { offset, barBottom } = scroll;
  const minimised = useTabBarMinimised();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrolled = useScrollOffset(scrollRef);
  const [refs] = useState(() => ({ animated: scrollRef, marked: insets === "automatic" }));
  const fadeStyle = useAnimatedStyle(() => ({
    height:
      typeof fadeHeight === "number"
        ? fadeHeight
        : offset.value > SCROLLED_PAST
          ? fadeHeight.scrolled
          : fadeHeight.rest,
  }));
  const listRef = useRef<FlashListRef<Row>>(null);
  // The view switches a commit after FlashList drops its layouts, which it would otherwise carry
  // from grid to list, leaving gaps once a card was deleted.
  const [shown, setShown] = useState(variant);
  const isGrid = shown === "grid";
  const focused = useIsFocused();

  // An automatic inset rests the list at minus the bar's bottom.
  useAnimatedReaction(
    () => scrolled.value,
    (y) => offset.set(y + barBottom)
  );

  useLayoutEffect(() => {
    if (shown === variant) return;
    listRef.current?.clearLayoutCacheOnUpdate();
    setShown(variant);
  }, [shown, variant]);

  // Leaving the screen, for another tab or a sheet over it, closes the open row.
  useEffect(() => {
    if (!focused) closeOpenRow();
  }, [focused]);

  return (
    // A touch that no row took closes the open one.
    <View className="flex-1" onTouchStart={() => closeOpenRow()}>
      <ScrollRefsContext value={refs}>
        <FlashList
          ref={listRef}
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
          contentContainerStyle={{ paddingBottom: tabListBottomInset(homeIndicator) }}
          contentInsetAdjustmentBehavior={insets}
          data={rows}
          keyExtractor={rowKey}
          numColumns={isGrid ? 2 : 1}
          renderItem={({ item, index }) => (
            <View
              className={isGrid ? "flex-1 flex-row pb-3" : "px-5 pb-3"}
              style={
                isGrid
                  ? {
                      paddingLeft: index % 2 === 0 ? GRID_EDGE : GRID_GAP / 2,
                      paddingRight: index % 2 === 0 ? GRID_GAP / 2 : GRID_EDGE,
                    }
                  : undefined
              }
            >
              {renderCard(item)}
            </View>
          )}
          renderScrollComponent={TabScrollView}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          testID={testID}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          onScrollBeginDrag={() => closeOpenRow()}
        />
      </ScrollRefsContext>
      {/* Cards dissolve into the page colour before the tab bar. */}
      <Animated.View
        className="to-background from-background/0 absolute inset-x-0 bottom-0 bg-linear-to-b to-75%"
        pointerEvents="none"
        style={fadeStyle}
      />
    </View>
  );
}
