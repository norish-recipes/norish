import type { ReactElement } from "react";
import React from "react";
import { View } from "react-native";
import type { HeaderConfirm } from "@/components/modal-header";
import { Sheet, SheetList } from "@/components/sheet";

import type { PickRowPosition } from "./pick-row";
import { PickRowSkeleton } from "./pick-row";

const SKELETON_ROWS = [0, 1, 2, 3, 4];

/** The rows of a pick sheet's list. */
export type PickList<Item> = {
  items: Item[];
  /** Shown when there is no item. */
  empty: ReactElement;
  keyExtractor: (item: Item) => string;
  renderRow: (item: Item, position: PickRowPosition) => ReactElement;
  onEndReached?: () => void;
};

/** A sheet of things to tick: `header` over `list`'s rows, `action` as the header's confirm
 * (off without an `onPress`). Without a `list` the rows are skeletons. */
export function PickSheet<Item>({
  name,
  title,
  subtitle,
  header,
  list,
  action,
}: {
  /** The testID prefix of the sheet, its list and its skeleton. */
  name: string;
  title: string;
  subtitle?: string;
  header: ReactElement;
  list?: PickList<Item>;
  action: HeaderConfirm;
}) {
  const items = list?.items ?? [];

  return (
    <Sheet
      confirm={action}
      name={name}
      subtitle={subtitle}
      title={title}
    >
      <SheetList
        ListEmptyComponent={
          list ? (
            list.empty
          ) : (
            <View testID={`${name}-skeleton`}>
              {SKELETON_ROWS.map((row) => (
                <PickRowSkeleton
                  key={row}
                  position={{ first: row === 0, last: row === SKELETON_ROWS.length - 1 }}
                />
              ))}
            </View>
          )
        }
        ListHeaderComponent={<View className="pb-3">{header}</View>}
        data={items}
        keyExtractor={(item) => list?.keyExtractor(item) ?? ""}
        renderItem={({ item, index }) =>
          list?.renderRow(item, { first: index === 0, last: index === items.length - 1 }) ?? null
        }
        testID={`${name}-list`}
        onEndReached={list?.onEndReached}
        onEndReachedThreshold={0.6}
      />
    </Sheet>
  );
}
