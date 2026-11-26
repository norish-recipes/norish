import type { Measurable } from "@/hooks/use-focused-field-in-view";
import React from "react";
import { Pressable, Text } from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@/components/icon";
import { usePopOnChange } from "@/lib/motion/pop-on-change";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { DONE_ROW_HEIGHT } from "../utils/list-rows";

/** The folded tail of a section: how many are done, opening on tap; the count swells as a ticked line joins it. */
export function DoneRow({
  count,
  open,
  sectionKey,
  viewRef,
  onToggle,
}: {
  count: number;
  open: boolean;
  sectionKey: string;
  /** Hands the row's view to the list, which measures it for a row leaving towards it. */
  viewRef: (view: Measurable | null) => void;
  onToggle: () => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const pop = usePopOnChange(count);

  return (
    <Pressable
      ref={(view) => viewRef(view)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      className="flex-row items-center gap-2 px-4"
      style={{ height: DONE_ROW_HEIGHT }}
      testID={`done-heading-${sectionKey}`}
      onPress={onToggle}
    >
      <Animated.View className="flex-1 flex-row" style={pop}>
        <Text className="text-muted text-[15px]">
          {intl.formatMessage({ id: "groceries.store.done" }, { count })}
        </Text>
      </Animated.View>
      <Ionicons color={muted} name={open ? "chevron-up" : "chevron-down"} size={16} />
    </Pressable>
  );
}
