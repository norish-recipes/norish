import React from "react";
import { Pressable, Text, View } from "react-native";
import { GestureDetector, useTapGesture } from "react-native-gesture-handler";
import { CardPhoto } from "@/components/card-photo";
import { SLOT_GLYPHS } from "@/components/slot-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";
import { useResolveClassNames } from "uniwind";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import { usePlannedItemText } from "@norish/shared-react/calendar";
import { slotTranslationKeys } from "@norish/shared-react/calendar/todays-meals";

import { useCardActionMenu } from "../hooks/use-card-action-menu";
import { useTodayActions } from "../hooks/use-today-actions";
import { TODAY_ACTION_DEFINITIONS, todayMenuActions } from "../utils/today-actions";
import { CardMenu } from "./card-menu";
import { PhotoChip } from "./photo-chip";

/** The one size of a Today card: the board's 172 by 244 pt, its photo 164 pt tall, 12 pt between. */
export const TODAY_CARD = "h-[244px] w-[172px] flex-none overflow-hidden rounded-[22px]";
export const TODAY_CARD_PHOTO = "h-[164px] w-[172px]";
export const TODAY_ROW_GAP = "gap-3";

/** How far one card scrolls the row: its width and the gap, read from the classes above. */
export function useTodayCardStep() {
  const { width } = useResolveClassNames(TODAY_CARD);
  const { gap } = useResolveClassNames(TODAY_ROW_GAP);

  return Number(width) + Number(gap);
}

function SlotChip({ slot }: { slot: Slot }) {
  const intl = useIntl();

  return (
    <PhotoChip
      className="absolute top-2.5 left-2.5"
      icon={SLOT_GLYPHS[slot]}
      label={intl.formatMessage({ id: `common.slots.${slotTranslationKeys[slot]}` })}
    />
  );
}

/** A slot with nothing planned: the add card, which opens Plan a recipe for it. */
export function TodayAddCard({ slot }: { slot: Slot }) {
  const intl = useIntl();
  const router = useRouter();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityLabel={`${intl.formatMessage({ id: "recipes.dashboard.addRecipe" })}, ${intl.formatMessage({ id: `common.slots.${slotTranslationKeys[slot]}` })}`}
      accessibilityRole="button"
      className={`bg-default items-center justify-center gap-2 ${TODAY_CARD}`}
      testID={`today-add-${slot}`}
      onPress={() => router.push({ pathname: "/plan-recipe", params: { slot } })}
    >
      <SlotChip slot={slot} />
      <Ionicons color={muted} name="add" size={26} />
      <Text className="text-foreground text-[15px] font-medium">
        {intl.formatMessage({ id: "recipes.dashboard.addRecipe" })}
      </Text>
    </Pressable>
  );
}

/** A planned slot as a photo card: its first item, `+n` for the others, a long press for Open, Move and Remove. */
export function TodayPlannedCard({
  slot,
  item,
  overflow,
}: {
  slot: Slot;
  item: PlannedItemFromQuery;
  /** How many more items the slot holds. */
  overflow: number;
}) {
  const [muted] = useThemeColor(["muted"] as const);
  const plannedItemText = usePlannedItemText();
  const { title, subtitle } = plannedItemText(item);
  const { isRecipe, handlers, href } = useTodayActions(item);
  const { items, accessibilityProps } = useCardActionMenu(
    todayMenuActions(isRecipe),
    (key) => TODAY_ACTION_DEFINITIONS[key],
    handlers
  );
  const tap = useTapGesture({ runOnJS: true, onActivate: handlers.open });

  return (
    <View
      accessible
      {...accessibilityProps}
      accessibilityLabel={title}
      accessibilityRole="button"
      testID={`today-card-${item.id}`}
      onAccessibilityTap={handlers.open}
    >
      <CardMenu href={href} items={items}>
        <GestureDetector gesture={tap}>
          <View className={`bg-surface ${TODAY_CARD}`} collapsable={false}>
            {isRecipe ? (
              <CardPhoto className={TODAY_CARD_PHOTO} image={item.recipeImage} />
            ) : (
              <View className={`bg-default items-center justify-center ${TODAY_CARD_PHOTO}`}>
                <Ionicons color={muted} name="document-text-outline" size={30} />
              </View>
            )}
            <SlotChip slot={slot} />
            {overflow > 0 ? (
              <PhotoChip semibold className="absolute top-2.5 right-2.5" label={`+${overflow}`} />
            ) : null}
            <View className="gap-0.5 px-3.5 pt-3">
              <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text className="text-muted text-sm" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </GestureDetector>
      </CardMenu>
    </View>
  );
}
