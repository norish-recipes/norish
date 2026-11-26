import type { ReactNode, Ref } from "react";
import type {
  FlatListProps,
  KeyboardEvent,
  ScrollViewInstance,
  ScrollViewProps,
} from "react-native";
import React, { useEffect, useState } from "react";
import { FlatList, Keyboard, Platform, ScrollView, useWindowDimensions, View } from "react-native";
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

const contentClass = ({ inset = true, contentClassName = "" }: BodyLayout) =>
  `${inset ? "px-4" : ""} pt-1 pb-4 ${contentClassName}`;

/** The native header's height over a sheet's content, measured on iOS 26 and 27. */
const SHEET_HEADER = 70;

/** A nested body ends above the home indicator, which a sheet at its full height reaches. */
const NESTED_SCROLL_END = { paddingBottom: 16 + (initialWindowMetrics?.insets.bottom ?? 0) };

/** iOS react-native-screens sizes a sheet's first scroll view to the whole sheet, header included,
 * so it runs a header's height past the sheet's bottom: its end pads past that too. */
export const SHEET_SCROLL_END = {
  paddingBottom: NESTED_SCROLL_END.paddingBottom + (Platform.OS === "ios" ? SHEET_HEADER : 0),
};

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
      contentContainerStyle={SHEET_SCROLL_END}
    />
  );
}

/** A sheet's body as a virtualised list. */
export function SheetList<T>({
  inset,
  contentClassName,
  nested = false,
  ...props
}: Omit<FlatListProps<T>, SheetOwnedProps> &
  BodyLayout & {
    /** Under other content, where react-native-screens leaves the list its laid-out height. */
    nested?: boolean;
    ref?: Ref<FlatList<T>>;
  }) {
  return (
    <FlatList
      {...SCROLLER}
      {...props}
      contentContainerClassName={contentClass({ inset, contentClassName })}
      contentContainerStyle={nested ? NESTED_SCROLL_END : SHEET_SCROLL_END}
    />
  );
}

/** Kept first in a fit sheet: react-native-screens stretches a sheet's first-child scroll view to the
 * sheet, so a scroll view after it keeps its own height. */
export function SheetScrollGuard() {
  return <View collapsable={false} />;
}

/** A fit sheet's body: as tall as its content until the sheet runs out of room, then it scrolls.
 * Its blocks sit 16 pt apart unless `contentClassName` says otherwise. */
export function SheetBody({
  children,
  contentClassName = "gap-4",
  ...layout
}: BodyLayout & { children: ReactNode }) {
  return (
    <>
      <SheetScrollGuard />
      <ScrollView
        {...SCROLLER}
        className="shrink grow-0"
        contentContainerClassName={contentClass({ ...layout, contentClassName })}
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
}: Omit<ScrollViewProps, SheetOwnedProps | "horizontal"> & {
  contentClassName?: string;
  ref?: Ref<ScrollViewInstance>;
}) {
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

/** The top of a sheet at its full height, the window's safe-area top. */
export const FULL_SHEET_TOP = initialWindowMetrics?.insets.top ?? 0;

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
  closable = true,
  onClose,
  confirm,
  secondary,
  children,
}: SheetActions & {
  /** The testID prefix: `<name>-sheet` on the sheet. */
  name: string;
  title: string;
  /** A muted second line in the header's title. */
  subtitle?: string;
  /** A step inside a sheet: the header's left item is a Back chevron. */
  back?: boolean;
  /** False disables the left item, for a sheet that must stay open. */
  closable?: boolean;
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
          closable={closable}
          confirm={confirm}
          secondary={secondary}
          subtitle={subtitle}
          title={title}
          onClose={onClose}
        />
        {children}
      </View>
    </OnSheet>
  );
}
