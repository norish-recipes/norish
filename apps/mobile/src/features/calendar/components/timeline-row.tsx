import type { Edge } from "@/lib/card-edges";
import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { CardSlice, ItemSlice } from "@/components/card-slice";
import { DayTitle, formatDay } from "@/components/day-card";
import { DragPressable, useIsLifted } from "@/components/drag-list/drag-list";
import { PlannedThumb } from "@/components/planned-thumb";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { usePlannedItemText } from "@norish/shared-react/calendar";
import { slotTranslationKeys } from "@norish/shared-react/calendar/todays-meals";

import type { TimelineHeading, TimelineItem } from "../utils/timeline-rows";
import {
  dayHeaderHeight,
  itemHeight,
  itemLineHeight,
  slotLabelHeight,
  TIMELINE,
} from "../utils/timeline-rows";

/** Today's ring, drawn over each of its card's slices: the sides, and the top or bottom at its ends. */
function TodayRing({ edge }: { edge: Edge }) {
  return (
    <View
      className={`border-accent-text/55 absolute inset-0 border-x-2 ${edge.top ? "rounded-t-3xl border-t-2" : ""} ${edge.bottom ? "rounded-b-3xl border-b-2" : ""}`}
      pointerEvents="none"
    />
  );
}

/** A day card's top: the date, Today named, and the add that opens add-to-day. */
export function DayHeadingRow({
  heading,
  onAdd,
}: {
  heading: Extract<TimelineHeading, { type: "day" }>;
  onAdd: () => void;
}) {
  const intl = useIntl();
  const { fontScale } = useWindowDimensions();
  const [foreground] = useThemeColor(["foreground"] as const);
  const day = formatDay(intl, heading.date);
  const edge = { top: true, bottom: heading.empty };

  return (
    <CardSlice edge={edge} gap={heading.gap} separated={false}>
      <View
        className="flex-row items-center gap-2 px-4"
        style={{ marginTop: TIMELINE.dayTop, height: dayHeaderHeight(fontScale) }}
        testID={`calendar-day-${heading.dayKey}`}
      >
        <DayTitle
          after="text-base leading-6"
          date={heading.date}
          isToday={heading.isToday}
          title="text-xl leading-7"
        />
        <Pressable
          accessibilityLabel={intl.formatMessage({ id: "calendar.panel.addToDay" }, { day })}
          accessibilityRole="button"
          className="bg-default size-9 items-center justify-center rounded-full"
          hitSlop={4}
          testID={`calendar-add-${heading.dayKey}`}
          onPress={onAdd}
        >
          <Ionicons color={foreground} name="add" size={20} />
        </Pressable>
        {heading.empty ? null : (
          <View className="bg-separator absolute inset-x-[18px] bottom-0 h-px" />
        )}
      </View>
      {heading.empty ? <View style={{ height: TIMELINE.emptyBottom }} /> : null}
      {heading.isToday ? <TodayRing edge={edge} /> : null}
    </CardSlice>
  );
}

/** A filled slot's label inside its day's card. */
export function SlotLabelRow({ heading }: { heading: Extract<TimelineHeading, { type: "slot" }> }) {
  const intl = useIntl();
  const { fontScale } = useWindowDimensions();
  const edge = { top: false, bottom: false };

  return (
    <CardSlice edge={edge} separated={false}>
      <View className="justify-end px-4 pb-2" style={{ height: slotLabelHeight(fontScale) }}>
        <Text className="text-muted text-[13px] leading-[18px]">
          {intl.formatMessage({ id: `common.slots.${slotTranslationKeys[heading.slot]}` })}
        </Text>
      </View>
      {heading.isToday ? <TodayRing edge={edge} /> : null}
    </CardSlice>
  );
}

/** A planned item: its photo or a note's tile, its name and details; a tap opens its sheet, a hold lifts it. */
export function PlannedItemRow({ row, onOpen }: { row: TimelineItem; onOpen: () => void }) {
  const { fontScale } = useWindowDimensions();
  const { title, subtitle } = usePlannedItemText()(row.item);
  const lifted = useIsLifted();
  const edge = { top: false, bottom: row.lastOfDay };

  return (
    <ItemSlice edge={edge} separated={false}>
      <DragPressable
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        accessibilityRole="button"
        className="justify-start px-4"
        style={{
          height: itemHeight(row, fontScale),
          paddingTop: row.firstInSlot ? 0 : TIMELINE.itemGap,
        }}
        testID={`calendar-item-${row.item.id}`}
        onPress={onOpen}
      >
        <PlannedItemLine height={itemLineHeight(fontScale)} subtitle={subtitle} title={title}>
          <PlannedThumb className="size-[52px] rounded-[14px]" item={row.item} />
        </PlannedItemLine>
      </DragPressable>
      {row.isToday && !lifted ? <TodayRing edge={edge} /> : null}
    </ItemSlice>
  );
}

/** A planned item's thumbnail, name and details on one line, `height` tall. */
function PlannedItemLine({
  title,
  subtitle,
  height,
  children,
}: {
  title: string;
  subtitle: string | null;
  height: number;
  children: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3.5" style={{ height }}>
      {children}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-foreground text-[17px] leading-[22px]" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted text-sm leading-5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
