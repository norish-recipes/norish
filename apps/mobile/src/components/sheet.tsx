import type { ReactNode } from "react";
import type {
  FlatListProps,
  KeyboardEvent,
  LayoutChangeEvent,
  ScrollViewProps,
} from "react-native";
import React, { useEffect, useState } from "react";
import { FlatList, Keyboard, LayoutAnimation, ScrollView, Text, View } from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { GlassCloseButton } from "./glass-close-button";

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

const contentClass = ({ inset = true, contentClassName = "" }: BodyLayout) =>
  `${inset ? "px-4" : ""} pb-4 ${contentClassName}`;

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

/** A row whose content lines up with the sheet's title. */
export function SheetRow({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <View className={`px-2 ${className}`}>{children}</View>;
}

/** Several actions in one row; each `Sheet.Action` takes an equal share. */
function SheetActions({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-2.5">{children}</View>;
}

function SheetAction({ children }: { children: ReactNode }) {
  return <View className="flex-1">{children}</View>;
}

/** The top of a sheet at its full height, the window's safe-area top. */
const FULL_SHEET_TOP = initialWindowMetrics?.insets.top ?? 0;

/**
 * How far the keyboard covers the sheet. UIKit lifts a sheet above it as far as its full height's
 * top; JS layout starts at the sheet's own top, so the sheet's height places its bottom.
 */
function useKeyboardOverlap() {
  const [height, setHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    const moveTo = (top: number | null) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardTop(top);
    };
    const subscriptions = [
      Keyboard.addListener("keyboardWillChangeFrame", (event: KeyboardEvent) =>
        moveTo(event.endCoordinates.screenY)
      ),
      Keyboard.addListener("keyboardWillHide", () => moveTo(null)),
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
 * The one sheet layout: title, subtitle and close on top, the body between, the actions pinned
 * below. They are flex siblings, and the keyboard's overlap pads the bottom so it covers none.
 */
export function Sheet({
  name,
  title,
  subtitle,
  onClose,
  actions,
  children,
}: {
  /** The testID prefix: `<name>-sheet` on the sheet, `<name>-close` on the close button. */
  name: string;
  title: string;
  subtitle?: string;
  /** What the close button does; going back by default. */
  onClose?: () => void;
  /** One element, or a `Sheet.Actions` of `Sheet.Action`s sharing the row. */
  actions?: ReactNode;
  /** A `SheetScrollView`, `SheetList` or `SheetBody`. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const { overlap, onLayout } = useKeyboardOverlap();

  return (
    // Not flattened, so react-native-screens never resizes the body directly.
    <View
      className="grow"
      collapsable={false}
      style={{ paddingBottom: overlap }}
      testID={`${name}-sheet`}
      onLayout={onLayout}
    >
      {/* Top-aligned so the close button never moves; pt-1.5 centres the title on the button. */}
      <View className="flex-row items-start justify-between gap-2.5 px-4 pt-[27px] pb-3.5">
        <View className="min-w-0 flex-1 pt-1.5 pl-2">
          <Text
            accessibilityRole="header"
            className="text-foreground text-[22px] leading-7 font-semibold"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-muted text-sm leading-[17px]" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <GlassCloseButton testID={`${name}-close`} onPress={onClose ?? (() => router.back())} />
      </View>
      {children}
      {actions ? <View className="px-4 pt-3 pb-5">{actions}</View> : null}
    </View>
  );
}

Sheet.Actions = SheetActions;
Sheet.Action = SheetAction;
