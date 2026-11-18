import type { ReactNode, Ref } from "react";
import type { FlatListProps, KeyboardEvent, ScrollViewProps } from "react-native";
import React, { useEffect, useState } from "react";
import { FlatList, Keyboard, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { useMarkSheetOpen } from "@/lib/tab-bar-visibility";

import type { SheetActions } from "./modal-header";
import { ModalHeader } from "./modal-header";
import { OnSheet } from "./on-sheet";

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

/** A scrolling body ends above the home indicator, which a sheet at its full height reaches. */
const SCROLL_END = { paddingBottom: 16 + (initialWindowMetrics?.insets.bottom ?? 0) };

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
      contentContainerStyle={SCROLL_END}
    />
  );
}

/** A sheet's body as a virtualised list. */
export function SheetList<T>({
  inset,
  contentClassName,
  ...props
}: Omit<FlatListProps<T>, SheetOwnedProps> & BodyLayout & { ref?: Ref<FlatList<T>> }) {
  return (
    <FlatList
      {...SCROLLER}
      {...props}
      contentContainerClassName={contentClass({ inset, contentClassName })}
      contentContainerStyle={SCROLL_END}
    />
  );
}

/** A fit sheet's body: as tall as its content until the sheet runs out of room, then it scrolls. */
export function SheetBody({ children, ...layout }: BodyLayout & { children: ReactNode }) {
  return (
    <>
      {/* Kept first: react-native-screens stretches a sheet's first-child scroll view to the sheet. */}
      <View collapsable={false} />
      <ScrollView
        {...SCROLLER}
        className="shrink grow-0"
        contentContainerClassName={contentClass(layout)}
      >
        {children}
      </ScrollView>
    </>
  );
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

/** The top of a sheet at its full height, the window's safe-area top. */
export const FULL_SHEET_TOP = initialWindowMetrics?.insets.top ?? 0;

/** The native header's height over a sheet's content, measured on iOS 26 and 27. */
const SHEET_HEADER = 70;

/** Where a sheet's content starts at the sheet's full height, under the native header. */
export const SHEET_BODY_TOP = FULL_SHEET_TOP + SHEET_HEADER;

/** The most the content can take: down to the keyboard or the screen's bottom. UIKit lifts a sheet
 * that then fits onto the keyboard, so nothing laid out feeds back into it. */
function useSheetRoom() {
  const { height } = useWindowDimensions();
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

  return (keyboardTop ?? height) - SHEET_BODY_TOP;
}

/** The one sheet layout: the native header (title, Close, secondary actions, confirm), then the
 * body, held to the room above the keyboard. Nothing is pinned below the body. */
export function Sheet({
  name,
  title,
  subtitle,
  back = false,
  onClose,
  confirm,
  secondary,
  children,
}: SheetActions & {
  /** The testID prefix: `<name>-sheet` on the sheet. */
  name: string;
  title: string;
  /** A muted line above the body: the header's system title has no subtitle. */
  subtitle?: string;
  /** A step inside a sheet: the header's left item is a Back chevron. */
  back?: boolean;
  /** What the left item does; going back by default. */
  onClose?: () => void;
  /** A `SheetScrollView`, `SheetList` or `SheetBody`. */
  children?: ReactNode;
}) {
  const room = useSheetRoom();

  useMarkSheetOpen();

  return (
    <OnSheet value>
      {/* Not flattened, so react-native-screens never resizes the body directly. */}
      <View
        className="grow"
        collapsable={false}
        style={{ maxHeight: room }}
        testID={`${name}-sheet`}
      >
        <ModalHeader
          back={back}
          confirm={confirm}
          secondary={secondary}
          title={title}
          onClose={onClose}
        />
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
      </View>
    </OnSheet>
  );
}
