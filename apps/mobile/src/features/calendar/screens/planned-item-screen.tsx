import React from "react";
import { Text, View } from "react-native";
import { MoveFields } from "@/components/move-fields";
import { PlannedItemSkeleton } from "@/components/planned-item-skeleton";
import { PlannedThumb } from "@/components/planned-thumb";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useCloseWhenGone } from "@/hooks/use-close-when-gone";
import { useConfirmRemovePlanned } from "@/hooks/use-confirm-remove-planned";
import { usePlannedItemSheet } from "@/hooks/use-planned-item-sheet";
import { TAB_ROUTES } from "@/lib/tab-routes";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarRangeQuery, usePlannedItemText } from "@norish/shared-react/calendar";
import { isRecipeItem } from "@norish/shared-react/calendar/todays-meals";
import { usePlatform } from "@norish/shared-react/platform";

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
  const { draft, changes, setTitle, saveAndClose, confirm, fields } = usePlannedItemSheet(item);
  const recipeId = isRecipeItem(item) ? item.recipeId : null;
  const [accentForeground, foreground, danger] = useThemeColor([
    "accent-foreground",
    "foreground",
    "danger",
  ] as const);

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
              <Ionicons color={accentForeground} name="book-outline" size={19} />
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
                  <Ionicons color={foreground} name="cart-outline" size={19} />
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
                <Ionicons color={danger} name="trash-outline" size={19} />
                <Button.Label>{intl.formatMessage({ id: "common.actions.remove" })}</Button.Label>
              </Button>
            </Sheet.Action>
          </Sheet.Actions>
        </View>
      }
      confirm={confirm}
      name="planned-item"
      subtitle={recipeId ? undefined : (subtitle ?? undefined)}
      title={title}
    >
      <SheetBody>
        {recipeId ? (
          <View className="flex-row items-center gap-3.5 px-2 pb-3">
            <PlannedThumb className="size-14 rounded-2xl" item={item} onSheet />
            {subtitle ? <Text className="text-muted flex-1 text-base">{subtitle}</Text> : null}
          </View>
        ) : null}
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
        <MoveFields {...fields} testID="planned-item" />
      </SheetBody>
    </Sheet>
  );
}
