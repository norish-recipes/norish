import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { useTodaysMeals } from "@norish/shared-react/calendar";
import { firstSlotFrom, nextMealSlot } from "@norish/shared-react/calendar/todays-meals";

import type { TodayActions } from "../hooks/use-today-actions";
import { TodayAddCard, TodayPlannedCard } from "./today-slot-card";

/** A card is 172 pt wide with 12 pt between. */
const CARD_STEP = 184;

type Today = ReturnType<typeof useTodaysMeals>;

/** The row of slot cards, opened on the next meal once, when it first draws. */
function TodayRow({ today, actions }: { today: Today; actions: TodayActions }) {
  const { itemsBySlot, visibleSlots } = today;
  const [opensAt] = useState(() => {
    const next = firstSlotFrom(visibleSlots, nextMealSlot(new Date().getHours()));

    return Math.max(next ? visibleSlots.indexOf(next) : 0, 0) * CARD_STEP;
  });

  return (
    <ScrollView
      horizontal
      contentContainerClassName="gap-3 px-5 pt-[18px]"
      contentOffset={{ x: opensAt, y: 0 }}
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      snapToOffsets={visibleSlots.map((_, index) => index * CARD_STEP)}
      testID="today-row"
    >
      {visibleSlots.map((slot) => {
        const [first, ...others] = itemsBySlot[slot];

        return first ? (
          <TodayPlannedCard
            key={slot}
            actions={actions}
            item={first}
            overflow={others.length}
            slot={slot}
          />
        ) : (
          <TodayAddCard key={slot} slot={slot} />
        );
      })}
    </ScrollView>
  );
}

/** Today's date, then its slots; a skeleton the size of the cards until the plan is known. */
export function TodaySection({ today, actions }: { today: Today; actions: TodayActions }) {
  const intl = useIntl();

  return (
    <View testID="today-section">
      <Text className="text-muted px-5 pt-0.5 text-base" testID="today-date">
        {intl.formatDate(today.todayDate, { weekday: "long", month: "short", day: "numeric" })}
      </Text>
      {today.isLoading ? (
        <View className="flex-row gap-3 overflow-hidden px-5 pt-[18px]" testID="today-skeleton">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-[244px] w-[172px] flex-none rounded-[22px]" />
          ))}
        </View>
      ) : (
        <TodayRow actions={actions} today={today} />
      )}
    </View>
  );
}
