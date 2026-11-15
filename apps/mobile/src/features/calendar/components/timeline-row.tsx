import type { Edge } from "@/components/card-edges";
import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { CardPhoto } from "@/components/card-photo";
import { CardSlice, ItemSlice } from "@/components/card-slice";
import { formatDay } from "@/components/day-card";
import { useIsLifted } from "@/components/drag-list/drag-list";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { usePlannedItemText } from "@norish/shared-react/calendar";
import { isRecipeItem, slotTranslationKeys } from "@norish/shared-react/calendar/todays-meals";

import type { TimelineHeading, TimelineItem } from "../utils/timeline-rows";
import { rowHeight, TIMELINE } from "../utils/timeline-rows";

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
  gap,
  onAdd,
}: {
  heading: Extract<TimelineHeading, { type: "day" }>;
  gap: boolean;
  onAdd: () => void;
}) {
  const intl = useIntl();
  const [foreground] = useThemeColor(["foreground"] as const);
  const day = formatDay(intl, heading.date);
  const edge = { top: true, bottom: heading.empty };

  return (
    <CardSlice edge={edge} gap={gap} separated={false}>
      <View
        className={`flex-row items-center gap-2 px-4 ${heading.empty ? "" : "border-separator border-b"}`}
        style={{ marginTop: TIMELINE.dayTop, height: TIMELINE.dayHeader }}
        testID={`calendar-day-${heading.dayKey}`}
      >
        <View className="min-w-0 flex-1 flex-row items-baseline gap-2">
          {heading.isToday ? (
            <>
              <Text accessibilityRole="header" className="text-accent-text text-xl font-semibold">
                {intl.formatMessage({ id: "calendar.mobile.today" })}
              </Text>
              <Text className="text-muted flex-shrink text-base" numberOfLines={1}>
                {day}
              </Text>
            </>
          ) : (
            <Text
              accessibilityRole="header"
              className="text-foreground text-xl font-semibold"
              numberOfLines={1}
            >
              {day}
            </Text>
          )}
        </View>
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
      </View>
      {heading.empty ? <View style={{ height: TIMELINE.emptyBottom }} /> : null}
      {heading.isToday ? <TodayRing edge={edge} /> : null}
    </CardSlice>
  );
}

/** A filled slot's label inside its day's card. */
export function SlotLabelRow({ heading }: { heading: Extract<TimelineHeading, { type: "slot" }> }) {
  const intl = useIntl();
  const edge = { top: false, bottom: false };

  return (
    <CardSlice edge={edge} separated={false}>
      <View className="justify-end px-4 pb-2" style={{ height: TIMELINE.slotLabel }}>
        <Text className="text-muted text-[13px]">
          {intl.formatMessage({ id: `common.slots.${slotTranslationKeys[heading.slot]}` })}
        </Text>
      </View>
      {heading.isToday ? <TodayRing edge={edge} /> : null}
    </CardSlice>
  );
}

/** A planned item: its photo or a note's tile, its name and details; a tap opens its sheet, a hold lifts it. */
export function PlannedItemRow({
  row,
  onOpen,
  onDrag,
}: {
  row: TimelineItem;
  onOpen: () => void;
  onDrag: () => void;
}) {
  const [muted] = useThemeColor(["muted"] as const);
  const { title, subtitle } = usePlannedItemText()(row.item);
  const lifted = useIsLifted();
  const edge = { top: false, bottom: row.lastOfDay };

  return (
    <ItemSlice edge={edge} separated={false}>
      <Pressable
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        accessibilityRole="button"
        className="justify-start px-4"
        style={{
          height: rowHeight({ kind: "item", key: "", value: row }),
          paddingTop: row.firstInSlot ? 0 : TIMELINE.itemGap,
        }}
        testID={`calendar-item-${row.item.id}`}
        onLongPress={onDrag}
        onPress={onOpen}
      >
        <PlannedItemLine subtitle={subtitle} title={title}>
          {isRecipeItem(row.item) ? (
            <CardPhoto className="size-[52px] rounded-[14px]" image={row.item.recipeImage} />
          ) : (
            <View className="bg-default size-[52px] items-center justify-center rounded-[14px]">
              <Ionicons color={muted} name="document-text-outline" size={20} />
            </View>
          )}
        </PlannedItemLine>
      </Pressable>
      {row.isToday && !lifted ? <TodayRing edge={edge} /> : null}
    </ItemSlice>
  );
}

/** A planned item's thumbnail, name and details on one 52 pt line. */
export function PlannedItemLine({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string | null;
  children: ReactNode;
}) {
  return (
    <View className="h-[52px] flex-row items-center gap-3.5">
      {children}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-foreground text-[17px]" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted text-sm" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
