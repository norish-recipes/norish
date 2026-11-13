import type { ScrollViewInstance } from "react-native";
import React, { useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { useTodaysMeals } from "@norish/shared-react/calendar";
import { firstSlotFrom, nextMealSlot } from "@norish/shared-react/calendar/todays-meals";

import { useReopenOnNextMeal } from "../hooks/use-reopen-on-next-meal";
import {
  TODAY_CARD,
  TODAY_ROW_GAP,
  TodayAddCard,
  TodayPlannedCard,
  useTodayCardStep,
} from "./today-slot-card";

type Today = ReturnType<typeof useTodaysMeals>;

/** The row of slot cards, opened on the next meal, again when the app resumes or the day turns. */
function TodayRow({ today }: { today: Today }) {
  const { itemsBySlot, visibleSlots } = today;
  const step = useTodayCardStep();
  const rowRef = useRef<ScrollViewInstance>(null);
  const draggingRef = useRef(false);
  const opensAt = () => {
    const next = firstSlotFrom(visibleSlots, nextMealSlot(new Date().getHours()));

    return Math.max(next ? visibleSlots.indexOf(next) : 0, 0) * step;
  };

  // Not while the person is scrolling the row.
  useReopenOnNextMeal(() => {
    if (!draggingRef.current) rowRef.current?.scrollTo({ x: opensAt(), animated: false });
  }, today.todayDate.getTime());

  return (
    <ScrollView
      ref={rowRef}
      horizontal
      contentContainerClassName={`${TODAY_ROW_GAP} px-5 pt-[18px]`}
      contentOffset={{ x: opensAt(), y: 0 }}
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      snapToOffsets={visibleSlots.map((_, index) => index * step)}
      testID="today-row"
      onMomentumScrollEnd={() => (draggingRef.current = false)}
      onScrollBeginDrag={() => (draggingRef.current = true)}
      onScrollEndDrag={({ nativeEvent }) => {
        if (nativeEvent.velocity?.x === 0) draggingRef.current = false;
      }}
    >
      {visibleSlots.map((slot) => {
        const [first, ...others] = itemsBySlot[slot];

        return first ? (
          <TodayPlannedCard key={slot} item={first} overflow={others.length} slot={slot} />
        ) : (
          <TodayAddCard key={slot} slot={slot} />
        );
      })}
    </ScrollView>
  );
}

/** Today's date, then its slots; a skeleton the size of the cards until the plan is known. */
export function TodaySection({ today }: { today: Today }) {
  const intl = useIntl();

  return (
    <View testID="today-section">
      <Text className="text-muted px-5 pt-0.5 text-base" testID="today-date">
        {intl.formatDate(today.todayDate, { weekday: "long", month: "short", day: "numeric" })}
      </Text>
      {today.isLoading ? (
        <View
          className={`flex-row overflow-hidden px-5 pt-[18px] ${TODAY_ROW_GAP}`}
          testID="today-skeleton"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className={TODAY_CARD} />
          ))}
        </View>
      ) : (
        <TodayRow today={today} />
      )}
    </View>
  );
}
