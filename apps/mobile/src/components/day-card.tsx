import type { IntlShape } from "react-intl";
import React from "react";
import { Text, View } from "react-native";
import { IconButton } from "@/components/icon-button";
import { PlannedThumb } from "@/components/planned-thumb";
import { DAY_CARD_CLASS } from "@/lib/day-card-height";
import { SLOT_GLYPHS } from "@/lib/slot-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import { usePlannedItemText } from "@norish/shared-react/calendar";
import {
  groupTodayItemsBySlot,
  slotTranslationKeys,
  TODAY_MEAL_SLOTS,
} from "@norish/shared-react/calendar/todays-meals";

/** A day on one line, as the calendar writes it: "Wed, Oct 7". */
export function formatDay(intl: IntlShape, date: Date) {
  return intl.formatDate(date, { weekday: "short", month: "short", day: "numeric" });
}

/** A day's date on one line, Today named first; the sizes are the caller's (`title` for the lead,
 * `date` for the date after Today). */
export function DayTitle({
  date,
  isToday,
  title,
  after,
}: {
  date: Date;
  isToday: boolean;
  title: string;
  after: string;
}) {
  const intl = useIntl();
  const formatted = formatDay(intl, date);

  return (
    <View className="min-w-0 flex-1 flex-row items-baseline gap-2">
      {isToday ? (
        <>
          <Text accessibilityRole="header" className={`text-accent-text font-semibold ${title}`}>
            {intl.formatMessage({ id: "calendar.mobile.today" })}
          </Text>
          <Text className={`text-muted flex-shrink ${after}`} numberOfLines={1}>
            {formatted}
          </Text>
        </>
      ) : (
        <Text
          accessibilityRole="header"
          className={`text-foreground font-semibold ${title}`}
          numberOfLines={1}
        >
          {formatted}
        </Text>
      )}
    </View>
  );
}

/** One planned item: its photo, or a note's glyph, and its name. */
function PlannedRow({ item }: { item: PlannedItemFromQuery }) {
  const { title } = usePlannedItemText()(item);

  return (
    <View
      className={`flex-row items-center gap-3 ${DAY_CARD_CLASS.row}`}
      testID={`day-item-${item.id}`}
    >
      <PlannedThumb className="size-10 rounded-[11px]" item={item} />
      <Text className="text-foreground flex-1 text-[15px]" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

/**
 * A day as a card: its date, what is planned in each slot, and a "+" that picks the day.
 * Heights are fixed (`lib/day-card-height.ts` adds them up), so a list can lay days out unmeasured.
 */
export function DayCard({
  date,
  dateKey,
  isToday,
  items,
  addLabel,
  onAdd,
}: {
  date: Date;
  dateKey: string;
  isToday: boolean;
  items: PlannedItemFromQuery[];
  /** What VoiceOver calls the "+". */
  addLabel: string;
  onAdd: () => void;
}) {
  const intl = useIntl();
  const bySlot = groupTodayItemsBySlot(items);

  return (
    <View
      className={`bg-sand rounded-3xl pr-2 pl-3.5 ${DAY_CARD_CLASS.card}`}
      testID={`day-card-${dateKey}`}
    >
      {isToday ? (
        <View
          className="border-accent-text/55 absolute inset-0 rounded-3xl border-2"
          pointerEvents="none"
        />
      ) : null}
      <View className={`flex-row items-center gap-2 ${DAY_CARD_CLASS.header}`}>
        <DayTitle after="text-[15px]" date={date} isToday={isToday} title="text-[17px]" />
        <IconButton
          icon="add"
          label={addLabel}
          testID={`day-add-${dateKey}`}
          tone="accent"
          onPress={onAdd}
        />
      </View>
      {TODAY_MEAL_SLOTS.filter((slot) => bySlot[slot].length > 0).map((slot) => (
        <View
          key={slot}
          className={`border-separator pr-1.5 ${DAY_CARD_CLASS.slot}`}
          testID={`day-slot-${dateKey}-${slot}`}
        >
          <View className={`flex-row items-center gap-1.5 ${DAY_CARD_CLASS.slotLabel}`}>
            <SlotGlyph slot={slot} />
            <Text className="text-muted text-[13px] font-semibold">
              {intl.formatMessage({ id: `common.slots.${slotTranslationKeys[slot]}` })}
            </Text>
          </View>
          {bySlot[slot].map((item) => (
            <PlannedRow key={item.id} item={item} />
          ))}
        </View>
      ))}
    </View>
  );
}

function SlotGlyph({ slot }: { slot: Slot }) {
  const [muted] = useThemeColor(["muted"] as const);

  return <Ionicons color={muted} name={SLOT_GLYPHS[slot]} size={14} />;
}

/** A day card's shape while the plan is still being read: its date and one planned row; `className` is its fill. */
export function DayCardSkeleton({ className = "bg-sand" }: { className?: string }) {
  return (
    <View
      className={`${className} rounded-3xl pt-[19px] pl-3.5 ${DAY_CARD_CLASS.skeleton}`}
      testID="day-card-skeleton"
    >
      <Skeleton className="h-5 w-32 rounded-md" />
      <View className="mt-9 flex-row items-center gap-3">
        <Skeleton className="size-10 rounded-[11px]" />
        <Skeleton className="h-4 w-40 rounded-md" />
      </View>
    </View>
  );
}
