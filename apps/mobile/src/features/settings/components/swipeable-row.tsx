import type { ReactNode } from "react";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import React, { useRef } from "react";
import { View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { closeOpenRow, useOpenRow } from "@/lib/open-row";

import type { SettingsRowAction } from "../utils/row-actions";
import { SwipeActionsPanel } from "./swipe-actions-panel";

/** A settings row's swipe: it reveals `actions` as circles and the row's content shrinks by the
 * swipe; one row is open at a time, and none while not `enabled`. */
export function SwipeableRow({
  actions,
  enabled,
  children,
}: {
  actions: SettingsRowAction[];
  enabled: boolean;
  children: ReactNode;
}) {
  const rowRef = useRef<SwipeableMethods>(null);
  const openRow = useOpenRow(rowRef);
  const width = useSharedValue(0);
  const translation = useSharedValue(0);
  const slide = useAnimatedStyle(() => ({
    width: width.get() > 0 ? width.get() + translation.get() : undefined,
    transform: [{ translateX: -translation.get() }],
  }));

  return (
    <View
      onLayout={(event) => width.set(event.nativeEvent.layout.width)}
      onTouchStart={(event) => {
        event.stopPropagation();
        closeOpenRow(openRow.row);
      }}
    >
      <ReanimatedSwipeable
        ref={rowRef}
        enabled={enabled}
        overshootRight={false}
        renderRightActions={(_progress, swipeTranslation, methods) => (
          <>
            <TranslationSync from={swipeTranslation} to={translation} />
            <SwipeActionsPanel actions={actions} enabled={enabled} methods={methods} />
          </>
        )}
        rightThreshold={40}
        onSwipeableClose={openRow.closed}
        onSwipeableWillOpen={openRow.opened}
      >
        <Animated.View style={slide}>{children}</Animated.View>
      </ReanimatedSwipeable>
    </View>
  );
}

/** Copies the swipe's translation onto the row's own value, where its content shrinks by it. */
function TranslationSync({ from, to }: { from: SharedValue<number>; to: SharedValue<number> }) {
  useAnimatedReaction(
    () => from.get(),
    (value) => to.set(value)
  );

  return null;
}
