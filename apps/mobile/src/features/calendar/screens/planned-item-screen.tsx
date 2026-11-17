import React from "react";
import { View } from "react-native";
import { MoveFields } from "@/components/move-fields";
import { PlannedItemSkeleton } from "@/components/planned-item-skeleton";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useCloseWhenGone } from "@/hooks/use-close-when-gone";
import { useConfirmRemovePlanned } from "@/hooks/use-confirm-remove-planned";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, TextField } from "heroui-native";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import {
  useCalendarRangeQuery,
  usePlannedItemDraft,
  usePlannedItemText,
} from "@norish/shared-react/calendar";
import { isRecipeItem } from "@norish/shared-react/calendar/todays-meals";
import { usePlatform } from "@norish/shared-react/platform";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

/** A planned item's sheet: a draft of its note's text, day and slot that Save writes as one change
 * and Close drops, its recipe, its groceries, and Remove after a confirm. */
export function PlannedItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { calendarData, isRead } = useCalendarRangeQuery();
  const items = Object.values(calendarData).flat();
  const item = items.find((candidate) => candidate.id === id);
  const gone = isRead && !item;

  useCloseWhenGone(gone);

  return item ? <PlannedItemSheet item={item} /> : <PlannedItemSkeleton name="planned-item" />;
}

function PlannedItemSheet({ item }: { item: PlannedItemFromQuery }) {
  const intl = useIntl();
  const router = useRouter();
  const { navigation } = usePlatform();
  const confirmRemove = useConfirmRemovePlanned();
  const { title, subtitle } = usePlannedItemText()(item);
  const { draft, changes, setTitle, setDate, setSlot, save } = usePlannedItemDraft(item);
  const recipeId = isRecipeItem(item) ? item.recipeId : null;
  const saveAndClose = () => {
    save();
    router.back();
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
                onPress={() => confirmRemove(item)}
              >
                <Button.Label>{intl.formatMessage({ id: "common.actions.remove" })}</Button.Label>
              </Button>
            </Sheet.Action>
          </Sheet.Actions>
        </View>
      }
      confirm={{
        label: intl.formatMessage({ id: "common.actions.save" }),
        disabled: !changes,
        onPress: saveAndClose,
      }}
      name="planned-item"
      subtitle={subtitle ?? undefined}
      title={title}
    >
      <SheetBody>
        {recipeId ? null : (
          <TextField className="mb-3">
            <SheetInput
              accessibilityLabel={intl.formatMessage({ id: "calendar.editNote.noteLabel" })}
              placeholder={intl.formatMessage({ id: "calendar.editNote.notePlaceholder" })}
              returnKeyType="done"
              testID="planned-item-note"
              value={draft.title}
              onChangeText={setTitle}
              onSubmitEditing={changes ? saveAndClose : undefined}
            />
          </TextField>
        )}
        <MoveFields
          date={parseDateKey(draft.date)}
          slot={draft.slot}
          testID="planned-item"
          onDateChange={(day) => setDate(dateKey(day))}
          onSlotChange={setSlot}
        />
      </SheetBody>
    </Sheet>
  );
}
