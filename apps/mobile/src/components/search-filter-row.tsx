import type { MenuItem } from "@/components/native-menu";
import React from "react";
import { View } from "react-native";
import { IconButton } from "@/components/icon-button";
import { IconMenu } from "@/components/icon-menu";
import { SheetSearchField } from "@/components/sheet-search-field";

/** A list's search field on the page, with the filter menu or button beside it, marked by a dot
 * while a filter applies. */
export function SearchFilterRow({
  label,
  value,
  testID,
  filter,
  onChange,
}: {
  label: string;
  value: string;
  testID: string;
  /** Opens a menu of `items`, or runs `onPress` where the filters have a sheet of their own. */
  filter?: {
    label: string;
    active: boolean;
    testID: string;
    items?: MenuItem[];
    onPress?: () => void;
  };
  onChange: (value: string) => void;
}) {
  return (
    <View className="flex-row items-center gap-2 px-5 pt-3 pb-1">
      <View className="min-w-0 flex-1">
        <SheetSearchField label={label} testID={testID} value={value} onChange={onChange} />
      </View>
      {filter ? (
        <View>
          {filter.items ? (
            <IconMenu
              icon="funnel-outline"
              items={filter.items}
              label={filter.label}
              testID={filter.testID}
            />
          ) : (
            <IconButton
              icon="funnel-outline"
              label={filter.label}
              testID={filter.testID}
              onPress={() => filter.onPress?.()}
            />
          )}
          {filter.active ? (
            <View
              className="bg-accent absolute top-0.5 right-0.5 size-2.5 rounded-full"
              pointerEvents="none"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
