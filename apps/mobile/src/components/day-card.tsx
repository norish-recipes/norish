import type { IntlShape } from "react-intl";
import React from "react";
import { Text, View } from "react-native";
import { CardPhoto } from "@/components/card-photo";
import { Button, Host, Image, Menu } from "@expo/ui/swift-ui";
import { accessibilityIdentifier, accessibilityLabel, frame } from "@expo/ui/swift-ui/modifiers";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";
import { useCSSVariable } from "uniwind";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import { usePlannedItemText } from "@norish/shared-react/calendar";
import {
  groupTodayItemsBySlot,
  isRecipeItem,
  slotTranslationKeys,
  TODAY_MEAL_SLOTS,
} from "@norish/shared-react/calendar/todays-meals";

import { DAY_CARD_CLASS } from "./day-card-height";
import { SLOT_GLYPHS, SLOT_SYMBOLS } from "./slot-icons";

/** A day on one line, as the calendar writes it: "Wed, Oct 7". */
export function formatDay(intl: IntlShape, date: Date) {
  return intl.formatDate(date, { weekday: "short", month: "short", day: "numeric" });
}

/** One planned item: its photo, or a note's glyph, and its name. */
function PlannedRow({ item }: { item: PlannedItemFromQuery }) {
  const [muted] = useThemeColor(["muted"] as const);
  const { title } = usePlannedItemText()(item);

  return (
    <View
      className={`flex-row items-center gap-3 ${DAY_CARD_CLASS.row}`}
      testID={`day-item-${item.id}`}
    >
      {isRecipeItem(item) ? (
        <CardPhoto className="size-10 rounded-[11px]" image={item.recipeImage} onSheet />
      ) : (
        <View className="bg-surface size-10 items-center justify-center rounded-[11px]">
          <Ionicons color={muted} name="document-text-outline" size={20} />
        </View>
      )}
      <Text className="text-foreground flex-1 text-[15px]" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

/** The "+" of a day: the native menu of the four slots, with no heading. */
function SlotMenu({
  addLabel,
  testID,
  onAdd,
}: {
  addLabel: string;
  testID: string;
  onAdd: (slot: Slot) => void;
}) {
  const intl = useIntl();
  const accentText = useCSSVariable("--color-accent-text");
  const [accent] = useThemeColor(["accent"] as const);

  return (
    <View className="bg-surface size-9 overflow-hidden rounded-full">
      <Host matchContents>
        <Menu
          label={
            <Image
              color={typeof accentText === "string" ? accentText : accent}
              modifiers={[frame({ width: 36, height: 36 })]}
              size={16}
              systemName="plus"
            />
          }
          modifiers={[accessibilityLabel(addLabel), accessibilityIdentifier(testID)]}
        >
          {TODAY_MEAL_SLOTS.map((slot) => (
            <Button
              key={slot}
              label={intl.formatMessage({ id: `common.slots.${slotTranslationKeys[slot]}` })}
              modifiers={[accessibilityIdentifier(`${testID}-${slot}`)]}
              systemImage={SLOT_SYMBOLS[slot]}
              onPress={() => onAdd(slot)}
            />
          ))}
        </Menu>
      </Host>
    </View>
  );
}

/**
 * A day as a card: its date, what is planned in each slot, and a "+" that asks for a slot.
 * Heights are fixed (`day-card-height.ts` adds them up), so a list can lay days out unmeasured.
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
  onAdd: (slot: Slot) => void;
}) {
  const intl = useIntl();
  const formatted = formatDay(intl, date);
  const bySlot = groupTodayItemsBySlot(items);

  return (
    <View
      className={`bg-default rounded-3xl pr-2 pl-3.5 ${DAY_CARD_CLASS.card}`}
      testID={`day-card-${dateKey}`}
    >
      {isToday ? (
        <View
          className="border-accent-text/55 absolute inset-0 rounded-3xl border-2"
          pointerEvents="none"
        />
      ) : null}
      <View className={`flex-row items-center gap-2 ${DAY_CARD_CLASS.header}`}>
        <View className="min-w-0 flex-1 flex-row items-baseline gap-2">
          {isToday ? (
            <>
              <Text className="text-accent-text text-[17px] font-semibold">
                {intl.formatMessage({ id: "calendar.mobile.today" })}
              </Text>
              <Text className="text-muted flex-shrink text-[15px]" numberOfLines={1}>
                {formatted}
              </Text>
            </>
          ) : (
            <Text className="text-foreground text-[17px] font-semibold" numberOfLines={1}>
              {formatted}
            </Text>
          )}
        </View>
        <SlotMenu addLabel={addLabel} testID={`day-add-${dateKey}`} onAdd={onAdd} />
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

/** A day card's shape while the plan is still being read: its date and one planned row. */
export function DayCardSkeleton() {
  return (
    <View
      className={`bg-default rounded-3xl pt-[19px] pl-3.5 ${DAY_CARD_CLASS.skeleton}`}
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
