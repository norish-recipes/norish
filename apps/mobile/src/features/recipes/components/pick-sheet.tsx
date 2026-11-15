import type { ComponentProps, ReactElement } from "react";
import React from "react";
import { View } from "react-native";
import { Sheet, SheetList } from "@/components/sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";

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

/**
 * A sheet of things to tick: `header` over the rows of `list`, the one `action` pinned below,
 * which stays off without an `onPress`. Without a `list` the rows are skeletons.
 */
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
  action: {
    label: string;
    icon: ComponentProps<typeof Ionicons>["name"];
    testID: string;
    onPress?: () => void;
  };
}) {
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);
  const items = list?.items ?? [];

  return (
    <Sheet
      actions={
        <Button
          className="h-[50px] rounded-full"
          isDisabled={!action.onPress}
          testID={action.testID}
          variant="primary"
          onPress={action.onPress}
        >
          <Ionicons color={accentForeground} name={action.icon} size={20} />
          <Button.Label className="text-base font-semibold">{action.label}</Button.Label>
        </Button>
      }
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
