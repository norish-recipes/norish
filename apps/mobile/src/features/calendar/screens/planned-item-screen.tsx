import React from "react";
import { Pressable, Text, View } from "react-native";
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
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TextField, useThemeColor } from "heroui-native";
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
  const [muted] = useThemeColor(["muted"] as const);
  const { navigation } = usePlatform();
  const confirmRemove = useConfirmRemovePlanned();
  const { title, subtitle } = usePlannedItemText()(item);
  const { draft, changes, setTitle, saveAndClose, confirm, fields } = usePlannedItemSheet(item);
  const recipeId = isRecipeItem(item) ? item.recipeId : null;

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
      title={recipeId ? intl.formatMessage({ id: "calendar.editPlannedRecipe.title" }) : title}
    >
      <SheetBody>
        {recipeId ? (
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-3.5 px-2 pb-3"
            testID="planned-item-recipe"
            onPress={() => {
              openAfterSheet(
                sheet,
                () => router.back(),
                () => navigation.toRecipe(recipeId)
              );
            }}
          >
            <PlannedThumb className="size-14 rounded-2xl" item={item} />
            <View className="min-w-0 flex-1">
              <Text className="text-foreground text-base font-medium" numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? <Text className="text-muted text-sm">{subtitle}</Text> : null}
            </View>
            <Ionicons color={muted} name="chevron-forward" size={18} />
          </Pressable>
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
        <PlanPicker {...fields} testID="planned-item" />
      </SheetBody>
    </Sheet>
  );
}
