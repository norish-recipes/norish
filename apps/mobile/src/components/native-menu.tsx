import type { ReactNode } from "react";
import type { ViewProps } from "react-native";
import React from "react";
import { View } from "react-native";
import { requireNativeView } from "expo";

/** One menu entry: a `key` stable across renders, its label, an SF Symbol, red when `destructive`. */
export type MenuItem = {
  key: string;
  label: string;
  systemImage?: string;
  destructive?: boolean;
  onPress: () => void;
};

type NativeItem = { id: string; title: string; systemImage?: string; destructive: boolean };

const NativeMenuView = requireNativeView<
  ViewProps & {
    items: NativeItem[];
    label: string;
    identifier: string;
    onSelect: (event: { nativeEvent: { id: string } }) => void;
  }
>("NativeMenu");

/** iOS's menu, opened by a tap on `children`: a UIKit button lies over them, so unlike a SwiftUI
 * menu it stays a plain view that scrolls with its content. `testID` names the button. */
export function NativeMenu({
  items,
  label,
  testID,
  children,
}: {
  items: MenuItem[];
  label: string;
  testID: string;
  children: ReactNode;
}) {
  return (
    <NativeMenuView
      identifier={testID}
      items={items.map((item) => ({
        id: item.key,
        title: item.label,
        systemImage: item.systemImage,
        destructive: item.destructive ?? false,
      }))}
      label={label}
      // By key: an open menu still shows the items it opened with, which may since have moved.
      onSelect={({ nativeEvent }) => items.find((item) => item.key === nativeEvent.id)?.onPress()}
    >
      {/* The button speaks for the menu; what it draws stays out of the accessibility tree. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    </NativeMenuView>
  );
}
