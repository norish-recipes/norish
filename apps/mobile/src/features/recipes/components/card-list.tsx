import type { ReactElement } from "react";
import React from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spinner } from "heroui-native";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

/** The tab bar's Add recipe accessory floats over the list's end, so the last row scrolls clear of it. */
const ACCESSORY_CLEARANCE = 72;
/** UIKit no longer insets the list for the tab bar, so its full height is added here. */
// ponytail: no docs-backed inset follows the minimised bar; 49 pt of extra space at the end then.
const TAB_BAR_HEIGHT = 49;

/** The Library's cards, a row each or two to a row, paged on scroll; `header` scrolls with them,
 * `empty` shows when there is no card. */
export function CardList<Row>({
  rows,
  variant,
  header,
  empty,
  isFetchingNextPage,
  rowKey,
  renderCard,
  onEndReached,
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
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const isGrid = variant === "grid";

  return (
    // Remounted per view: a FlatList's column count can't change under it.
    <FlatList
      key={variant}
      ListEmptyComponent={empty}
      ListFooterComponent={isFetchingNextPage ? <Spinner className="py-4" /> : undefined}
      ListHeaderComponent={header}
      className="flex-1"
      columnWrapperClassName={isGrid ? "mb-3 gap-3 px-5" : undefined}
      contentContainerStyle={{
        paddingBottom: insets.bottom + TAB_BAR_HEIGHT + ACCESSORY_CLEARANCE,
      }}
      contentInsetAdjustmentBehavior="never"
      data={rows}
      keyExtractor={rowKey}
      numColumns={isGrid ? 2 : 1}
      renderItem={({ item }) => {
        const card = renderCard(item);

        return isGrid ? card : <View className="px-5 pb-3">{card}</View>;
      }}
      testID={testID}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
    />
  );
}
