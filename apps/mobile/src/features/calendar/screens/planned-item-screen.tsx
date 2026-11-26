import React from "react";
import { View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { destructiveAction } from "@/components/modal-header";
import { PlanPicker } from "@/components/plan-block";
import { PlannedItemSkeleton } from "@/components/planned-item-skeleton";
import { PlannedThumb } from "@/components/planned-thumb";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useCloseWhenGone } from "@/hooks/use-close-when-gone";
import { useConfirmRemovePlanned } from "@/hooks/use-confirm-remove-planned";
import { usePlannedItemSheet } from "@/hooks/use-planned-item-sheet";
import { openAfterSheet, useSheetPresenting } from "@/lib/after-sheet";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TextField } from "heroui-native";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarRangeQuery, usePlannedItemText } from "@norish/shared-react/calendar";
import { isRecipeItem, isRecipeOutOfView } from "@norish/shared-react/calendar/todays-meals";
import { usePlatform } from "@norish/shared-react/platform";

/** A planned item's sheet: a draft of its note's text, day and slot that Save writes as one change
 * and Close drops, its recipe, its groceries, and Remove after a confirm. */
export function PlannedItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { calendarData, isRead } = useCalendarRangeQuery();
  const items = Object.values(calendarData).flat();
  const item = items.find((candidate) => candidate.id === id);
  const gone = isRead && !item;

  const sheet = useSheetPresenting();

  useCloseWhenGone(gone);

  return item ? (
    <PlannedItemSheet item={item} sheet={sheet} />
  ) : (
    <PlannedItemSkeleton name="planned-item" />
  );
}

function PlannedItemSheet({ item, sheet }: { item: PlannedItemFromQuery; sheet: string }) {
  const intl = useIntl();
  const router = useRouter();
  const { navigation } = usePlatform();
  const confirmRemove = useConfirmRemovePlanned();
  const { title, subtitle } = usePlannedItemText()(item);
  const { draft, changes, setTitle, saveAndClose, confirm, fields } = usePlannedItemSheet(item);
  const recipeId = isRecipeItem(item) ? item.recipeId : null;
  const outOfView = isRecipeOutOfView(item);

  return (
    <Sheet
      confirm={confirm}
      name="planned-item"
      secondary={[
        ...(recipeId
          ? [
              {
                label: intl.formatMessage({ id: "navbar.nav.groceries" }),
                symbol: "cart",
                onPress: () =>
                  router.replace({
                    pathname: TAB_ROUTES.calendar.addToGroceries,
                    params: { recipeId },
                  }),
              } as const,
            ]
          : []),
        destructiveAction(intl.formatMessage({ id: "common.actions.remove" }), () =>
          confirmRemove(item)
        ),
      ]}
      title={
        recipeId || outOfView
          ? intl.formatMessage({ id: "calendar.editPlannedRecipe.title" })
          : title
      }
    >
      <SheetBody contentClassName="">
        {recipeId ? (
          <View className="mb-3">
            <Card>
              <CardRow
                first
                hint={subtitle || undefined}
                label={title}
                media={<PlannedThumb className="size-10 rounded-xl" item={item} />}
                testID="planned-item-recipe"
                onPress={() => {
                  openAfterSheet(
                    sheet,
                    () => router.back(),
                    () => navigation.toRecipe(recipeId)
                  );
                }}
              />
            </Card>
          </View>
        ) : outOfView ? (
          <View className="mb-3">
            <Card>
              <CardRow first label={title} testID="planned-item-recipe-title-only" />
            </Card>
          </View>
        ) : (
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
        <PlanPicker {...fields} testID="planned-item" />
      </SheetBody>
    </Sheet>
  );
}
