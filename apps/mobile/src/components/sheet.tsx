import type { ReactNode } from "react";
import type {
  FlatListProps,
  KeyboardEvent,
  LayoutChangeEvent,
  ScrollViewProps,
} from "react-native";
import React, { useEffect, useState } from "react";
import { FlatList, Keyboard, ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { useMarkSheetOpen } from "@/lib/tab-bar-visibility";

import type { HeaderConfirm } from "./modal-header";
import { ModalHeader } from "./modal-header";

/** The props a body takes from the sheet rather than from the screen. */
type SheetOwnedProps =
  "className" | "contentContainerClassName" | "style" | "contentContainerStyle";

/** How every body lays out its content. */
type BodyLayout = {
  /** False runs the content to the sheet's sides, for rows that bleed. */
  inset?: boolean;
  /** Added to the content's classes, such as its gap. */
  contentClassName?: string;
};

/** The body's side inset in points, the `px-4` below: for a layout that sizes itself to the sheet. */
export const SHEET_INSET = 16;

/** A tall field's height on a fit sheet, which is as tall as its content, so no field can fill it. */
export const FIT_SHEET_FIELD_HEIGHT = 200;

/** Where the native title starts, which the subtitle and a `SheetRow` line up with. */
const TITLE_INSET = 24;

const contentClass = ({ inset = true, contentClassName = "" }: BodyLayout) =>
  `${inset ? "px-4" : ""} pt-1 pb-4 ${contentClassName}`;

/** What both scrolling bodies share: they fill the sheet and meet the keyboard the same way. */
const SCROLLER = {
  className: "flex-1",
  contentInsetAdjustmentBehavior: "never",
  keyboardDismissMode: "on-drag",
  keyboardShouldPersistTaps: "handled",
  showsVerticalScrollIndicator: false,
} as const;

/** A sheet's body that scrolls. */
export function SheetScrollView({
  inset,
  contentClassName,
  ...props
}: Omit<ScrollViewProps, SheetOwnedProps> & BodyLayout) {
  return (
    <ScrollView
      {...SCROLLER}
      {...props}
      contentContainerClassName={contentClass({ inset, contentClassName })}
    />
  );
}

/** A sheet's body as a virtualised list. */
export function SheetList<T>({
  inset,
  contentClassName,
  ...props
}: Omit<FlatListProps<T>, SheetOwnedProps> & BodyLayout) {
  return (
    <FlatList
      {...SCROLLER}
      {...props}
      contentContainerClassName={contentClass({ inset, contentClassName })}
    />
  );
}

/** A sheet's body that does not scroll, as tall as its content: the body of a fit sheet. */
export function SheetBody({ children, ...layout }: BodyLayout & { children: ReactNode }) {
  return <View className={contentClass(layout)}>{children}</View>;
}

/** A horizontal strip that runs to the sheet's sides, its content starting on the sheet's inset. */
export function SheetStrip({
  contentClassName = "",
  ...props
}: Omit<ScrollViewProps, SheetOwnedProps | "horizontal"> & { contentClassName?: string }) {
  return (
    <ScrollView
      horizontal
      className="-mx-4"
      contentContainerClassName={`px-4 ${contentClassName}`}
      showsHorizontalScrollIndicator={false}
      {...props}
    />
  );
}

/** A row whose content lines up with the sheet's subtitle. */
export function SheetRow({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={className} style={{ paddingHorizontal: TITLE_INSET - SHEET_INSET }}>
      {children}
    </View>
  );
}

/** Several actions in one row; each `Sheet.Action` takes an equal share. */
function SheetActions({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-2.5">{children}</View>;
}

function SheetAction({ children }: { children: ReactNode }) {
  return <View className="flex-1">{children}</View>;
}

/** The top of a sheet at its full height, the window's safe-area top. */
export const FULL_SHEET_TOP = initialWindowMetrics?.insets.top ?? 0;

/**
 * How far the keyboard covers the sheet. UIKit lifts a sheet above it as far as its full height's
 * top; JS layout starts at the sheet's own top, so the sheet's height places its bottom.
 */
function useKeyboardOverlap() {
  const [height, setHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    const subscriptions = [
      Keyboard.addListener("keyboardWillChangeFrame", (event: KeyboardEvent) =>
        setKeyboardTop(event.endCoordinates.screenY)
      ),
      Keyboard.addListener("keyboardWillHide", () => setKeyboardTop(null)),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return {
    overlap:
      keyboardTop === null ? 0 : Math.max(0, Math.round(FULL_SHEET_TOP + height - keyboardTop)),
    onLayout: (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height),
  };
}

/**
 * The one sheet layout: the native header (title, Close, and Save where it saves), the body, the
 * actions pinned below. The keyboard's overlap pads the bottom so it covers none.
 */
export function Sheet({
  name,
  title,
  subtitle,
  back = false,
  onClose,
  confirm,
  actions,
  children,
}: {
  /** The testID prefix: `<name>-sheet` on the sheet. */
  name: string;
  title: string;
  /** A muted line above the body: the header's system title has no subtitle. */
  subtitle?: string;
  /** A step inside a sheet: the header's left item is a Back chevron. */
  back?: boolean;
  /** What the left item does; going back by default. */
  onClose?: () => void;
  /** The header's confirm item, for a sheet that saves. */
  confirm?: HeaderConfirm;
  /** One element, or a `Sheet.Actions` of `Sheet.Action`s sharing the row. */
  actions?: ReactNode;
  /** A `SheetScrollView`, `SheetList` or `SheetBody`. */
  children?: ReactNode;
}) {
  const { overlap, onLayout } = useKeyboardOverlap();

  useMarkSheetOpen();
  // Animated on this view only: a global LayoutAnimation left armed by a picker's keyboard events
  // animated the sheet's unmount, which Reanimated's layout animations abort on.
  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: withTiming(overlap, { duration: 250 }),
  }));

  return (
    // Not flattened, so react-native-screens never resizes the body directly.
    <Animated.View
      className="grow"
      collapsable={false}
      style={keyboardStyle}
      testID={`${name}-sheet`}
      onLayout={onLayout}
    >
      <ModalHeader back={back} confirm={confirm} title={title} onClose={onClose} />
      {subtitle ? (
        <Text
          className="text-muted pb-3 text-sm leading-[17px]"
          numberOfLines={1}
          style={{ paddingHorizontal: TITLE_INSET }}
        >
          {subtitle}
        </Text>
      ) : null}
      {children}
      {actions ? <View className="px-4 pt-3 pb-5">{actions}</View> : null}
    </Animated.View>
  );
}

Sheet.Actions = SheetActions;
Sheet.Action = SheetAction;
