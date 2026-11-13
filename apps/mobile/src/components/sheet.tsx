import type { ReactNode } from "react";
import type { FlatListProps, ScrollViewProps } from "react-native";
import React, { createContext, use } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";

import { GlassCloseButton } from "./glass-close-button";

/** The sheet's name, from which its body's testID comes. */
const SheetNameContext = createContext("sheet");

/** What the sheet decides about its body: its place, its insets, its keyboard and its testID. */
function useBodyProps() {
  const name = use(SheetNameContext);

  return {
    className: "flex-1",
    contentContainerClassName: "px-4 pb-4",
    contentInsetAdjustmentBehavior: "never",
    keyboardDismissMode: "on-drag",
    keyboardShouldPersistTaps: "handled",
    showsVerticalScrollIndicator: false,
    testID: `${name}-sheet`,
  } as const;
}

type Owned =
  "className" | "contentContainerClassName" | "style" | "contentContainerStyle" | "testID";

/** A sheet's body as a scroll view; `gapClassName` spaces its children. */
export function SheetScrollView({
  gapClassName = "",
  children,
  ...props
}: Omit<ScrollViewProps, Owned> & { gapClassName?: string }) {
  const body = useBodyProps();

  return (
    <ScrollView
      {...body}
      {...props}
      contentContainerClassName={`${body.contentContainerClassName} ${gapClassName}`}
    >
      {children}
    </ScrollView>
  );
}

/** A sheet's body as a virtualised list. */
export function SheetList<T>(props: Omit<FlatListProps<T>, Owned>) {
  return <FlatList {...useBodyProps()} {...props} />;
}

/**
 * The one sheet layout: the title, subtitle and close button on top, the body (a `SheetScrollView`
 * or `SheetList`) between, and the actions pinned below, each action taking an equal share. All
 * three are flex siblings of a sheet-sized column, so the body scrolls under neither.
 */
export function Sheet({
  name,
  title,
  subtitle,
  onClose,
  actions,
  children,
}: {
  /** The testID prefix: `<name>-sheet` on the body, `<name>-close` on the close button. */
  name: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Each action gets an equal share of the row; give each a key. */
  actions?: ReactNode[];
  children: ReactNode;
}) {
  return (
    <SheetNameContext value={name}>
      {/* Not flattened, so the body is never a direct child that react-native-screens resizes. */}
      <View className="flex-1" collapsable={false}>
        {/* Top-aligned, so the close button sits in one place with or without a subtitle; pt-1.5
            centres the 28 pt title line on the 40 pt button. */}
        <View className="flex-row items-start justify-between gap-2.5 px-4 pt-[27px] pb-3.5">
          <View className="min-w-0 flex-1 pt-1.5 pl-2">
            <Text className="text-foreground text-[22px] leading-7 font-semibold">{title}</Text>
            {subtitle ? (
              <Text className="text-muted text-sm leading-[17px]" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <GlassCloseButton testID={`${name}-close`} onPress={onClose} />
        </View>
        {children}
        {actions ? (
          <View className="flex-row gap-2.5 px-4 pt-3 pb-5">
            {actions.map((action, index) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key -- the actions never reorder
              <View key={index} className="flex-1">
                {action}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </SheetNameContext>
  );
}
