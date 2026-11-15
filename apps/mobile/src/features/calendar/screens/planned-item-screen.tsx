import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Sheet, SheetBody } from "@/components/sheet";
import { SlotTabs } from "@/components/slot-tabs";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { accessibilityIdentifier, tint } from "@expo/ui/swift-ui/modifiers";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Input, Skeleton, TextField } from "heroui-native";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import {
  useCalendarMutations,
  useCalendarRangeQuery,
  usePlannedItemText,
} from "@norish/shared-react/calendar";
import { isRecipeItem } from "@norish/shared-react/calendar/todays-meals";
import { usePlatform } from "@norish/shared-react/platform";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

/**
 * A planned item's sheet: a note's text with Save, its date and slot, which move it at once, its
 * recipe, its groceries, and Remove.
 */
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
  const { moveItem, deleteItem, updateItem } = useCalendarMutations();
  const { reach } = useCalendarRangeQuery();
  const { title, subtitle } = usePlannedItemText()(item);
  const accent = useAccentTextColor();
  const recipeId = isRecipeItem(item) ? item.recipeId : null;
  // A note's text, saved on Save as web's note panel does.
  const [note, setNote] = useState(item.title ?? "");
  const noteChanged = !recipeId && note.trim().length > 0 && note.trim() !== item.title;
  const saveNote = () => {
    updateItem(item.id, note.trim());
    router.back();
  };
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
            {recipeId ? null : (
              <Sheet.Action>
                <Button
                  className="h-[50px]"
                  isDisabled={!noteChanged}
                  testID="planned-item-save"
                  variant="primary"
                  onPress={saveNote}
                >
                  <Button.Label className="font-semibold">
                    {intl.formatMessage({ id: "common.actions.save" })}
                  </Button.Label>
                </Button>
              </Sheet.Action>
            )}
            {recipeId ? (
              <Sheet.Action>
                <Button
                  className="h-[50px]"
                  testID="planned-item-groceries"
                  variant="secondary"
                  onPress={() =>
                    router.replace({
                      pathname: TAB_ROUTES.calendar.addToGroceries,
                      params: { recipeId },
                    })
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
        {recipeId ? null : (
          <TextField className="mb-3">
            <Input
              accessibilityLabel={intl.formatMessage({ id: "calendar.editNote.noteLabel" })}
              className="h-12 rounded-full px-4 text-base"
              placeholder={intl.formatMessage({ id: "calendar.editNote.notePlaceholder" })}
              returnKeyType="done"
              testID="planned-item-note"
              value={note}
              onChangeText={setNote}
              onSubmitEditing={noteChanged ? saveNote : undefined}
            />
          </TextField>
        )}
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
            <SlotTabs
              inCard
              testID="planned-item-slot"
              value={item.slot}
              onChange={(slot) => moveTo(item.date, slot)}
            />
          </View>
        </View>
      </SheetBody>
    </Sheet>
  );
}
