import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { Sheet, SheetBody } from "@/components/sheet";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { accessibilityIdentifier, tint } from "@expo/ui/swift-ui/modifiers";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Skeleton, Tabs } from "heroui-native";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import {
  useCalendarMutations,
  useCalendarRangeQuery,
  usePlannedItemText,
} from "@norish/shared-react/calendar";
import {
  isRecipeItem,
  slotTranslationKeys,
  TODAY_MEAL_SLOTS,
} from "@norish/shared-react/calendar/todays-meals";
import { usePlatform } from "@norish/shared-react/platform";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

/** A planned item's sheet: its date and slot, which move it at once, its recipe, its groceries, and Remove. */
export function PlannedItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { calendarData, isRead } = useCalendarRangeQuery();
  const items = Object.values(calendarData).flat();
  const item = items.find((candidate) => candidate.id === id);
  const gone = isRead && !item;

  // Removed here or by someone else: nothing left to show.
  useEffect(() => {
    if (gone) router.back();
  }, [gone, router]);

  if (!item) {
    return (
      <Sheet name="planned-item" title="">
        <SheetBody>
          <Skeleton className="h-[110px] rounded-[22px]" />
        </SheetBody>
      </Sheet>
    );
  }

  return <PlannedItemSheet item={item} />;
}

function PlannedItemSheet({ item }: { item: PlannedItemFromQuery }) {
  const intl = useIntl();
  const router = useRouter();
  const { navigation } = usePlatform();
  const { moveItem, deleteItem } = useCalendarMutations();
  const { reach } = useCalendarRangeQuery();
  const { title, subtitle } = usePlannedItemText()(item);
  const accent = useAccentTextColor();
  const recipeId = isRecipeItem(item) ? item.recipeId : null;
  // Another day or slot: last there, as a drag puts it. The range reaches the day, so it stays on show.
  const moveTo = (day: string, slot: Slot) => {
    if (day === item.date && slot === item.slot) return;
    reach(day);
    moveItem(item.id, day, slot);
  };

  return (
    <Sheet
      actions={
        <View className="gap-2.5">
          {recipeId ? (
            <Button
              className="h-[50px]"
              testID="planned-item-recipe"
              variant="primary"
              onPress={() => {
                router.back();
                navigation.toRecipe(recipeId);
              }}
            >
              <Button.Label className="font-semibold">
                {intl.formatMessage({ id: "calendar.timeline.goToRecipe" })}
              </Button.Label>
            </Button>
          ) : null}
          <Sheet.Actions>
            {recipeId ? (
              <Sheet.Action>
                <Button
                  className="h-[50px]"
                  testID="planned-item-groceries"
                  variant="secondary"
                  onPress={() =>
                    router.replace({ pathname: "/calendar/add-to-groceries", params: { recipeId } })
                  }
                >
                  <Button.Label>{intl.formatMessage({ id: "navbar.nav.groceries" })}</Button.Label>
                </Button>
              </Sheet.Action>
            ) : null}
            <Sheet.Action>
              <Button
                className="h-[50px]"
                testID="planned-item-remove"
                variant="danger-soft"
                onPress={() => {
                  deleteItem(item.id);
                  router.back();
                }}
              >
                <Button.Label>{intl.formatMessage({ id: "common.actions.remove" })}</Button.Label>
              </Button>
            </Sheet.Action>
          </Sheet.Actions>
        </View>
      }
      name="planned-item"
      subtitle={subtitle ?? undefined}
      title={title}
    >
      <SheetBody>
        <View className="bg-default overflow-hidden rounded-[22px]">
          <View className="h-[52px] flex-row items-center justify-between pr-3 pl-4">
            <Text className="text-foreground text-base">
              {intl.formatMessage({ id: "calendar.editPlannedRecipe.date" })}
            </Text>
            <Host matchContents>
              <DatePicker
                modifiers={[
                  accessibilityIdentifier("planned-item-date"),
                  ...(accent ? [tint(accent)] : []),
                ]}
                selection={parseDateKey(item.date)}
                onDateChange={(date) => moveTo(dateKey(date), item.slot)}
              />
            </Host>
          </View>
          <View className="border-separator gap-2 border-t px-3 pt-2.5 pb-3">
            <Text className="text-muted mx-1 text-[13px]">
              {intl.formatMessage({ id: "calendar.editPlannedRecipe.slot" })}
            </Text>
            <Tabs
              value={item.slot}
              onValueChange={(next) => {
                const slot = TODAY_MEAL_SLOTS.find((candidate) => candidate === next);

                if (slot) moveTo(item.date, slot);
              }}
            >
              <Tabs.List className="bg-surface h-10 rounded-full p-[3px]">
                <Tabs.Indicator className="bg-default rounded-full" />
                {TODAY_MEAL_SLOTS.map((slot) => (
                  <Tabs.Trigger
                    key={slot}
                    className="h-[34px] flex-1 px-0"
                    testID={`planned-item-slot-${slot}`}
                    value={slot}
                  >
                    <Tabs.Label className="text-sm font-medium" numberOfLines={1}>
                      {intl.formatMessage({ id: `common.slots.${slotTranslationKeys[slot]}` })}
                    </Tabs.Label>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </View>
        </View>
      </SheetBody>
    </Sheet>
  );
}
