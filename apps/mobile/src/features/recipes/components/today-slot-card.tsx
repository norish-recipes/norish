import React from "react";
import { Pressable, Text, View } from "react-native";
import { GestureDetector, useTapGesture } from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import {
  buildPlannedItemSubtitle,
  getPlannedItemTitle,
  slotTranslationKeys,
} from "@norish/shared-react/calendar/todays-meals";

import type { TodayActions } from "../hooks/use-today-actions";
import type { TodayMenuAction } from "../utils/today-actions";
import { useCardActionMenu } from "../hooks/use-card-action-menu";
import { TODAY_ACTION_DEFINITIONS, todayMenuActions } from "../utils/today-actions";
import { CardMenu } from "./card-menu";
import { CardPhoto } from "./card-photo";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const SLOT_ICONS: Record<Slot, IconName> = {
  Breakfast: "partly-sunny-outline",
  Lunch: "sunny-outline",
  Dinner: "moon-outline",
  Snack: "sparkles-outline",
};

/** The board's card: 172 by 244 pt, its photo 164 pt tall. */
const CARD = "h-[244px] w-[172px] flex-none overflow-hidden rounded-[22px]";

function SlotChip({ slot }: { slot: Slot }) {
  const intl = useIntl();
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <View className="bg-surface/80 absolute top-2.5 left-2.5 h-7 flex-row items-center gap-[5px] rounded-[14px] pr-2.5 pl-2">
      <Ionicons color={foreground} name={SLOT_ICONS[slot]} size={14} />
      <Text className="text-foreground text-[13px] font-medium">
        {intl.formatMessage({ id: `common.slots.${slotTranslationKeys[slot]}` })}
      </Text>
    </View>
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
      className={`bg-default items-center justify-center gap-2 ${CARD}`}
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
  actions,
}: {
  slot: Slot;
  item: PlannedItemFromQuery;
  /** How many more items the slot holds. */
  overflow: number;
  actions: TodayActions;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const isRecipe = item.itemType === "recipe" && item.recipeId !== null;
  const title = getPlannedItemTitle(item, intl.formatMessage({ id: "calendar.timeline.untitled" }));
  const subtitle = buildPlannedItemSubtitle(item, {
    note: intl.formatMessage({ id: "calendar.timeline.note" }),
    serving: intl.formatMessage({ id: "calendar.timeline.serving" }),
    servings: intl.formatMessage({ id: "calendar.timeline.servings" }),
  });
  const handlers: Record<TodayMenuAction, () => void> = {
    open: () => actions.open(item),
    move: () => actions.move(item),
    remove: () => actions.remove(item),
  };
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
      <CardMenu
        href={
          isRecipe && item.recipeId
            ? { pathname: "/recipe/[id]", params: { id: item.recipeId } }
            : "/calendar"
        }
        items={items}
      >
        <GestureDetector gesture={tap}>
          <View className={`bg-surface ${CARD}`} collapsable={false}>
            {item.itemType === "recipe" ? (
              <CardPhoto className="h-[164px] w-[172px]" image={item.recipeImage} />
            ) : (
              <View className="bg-default h-[164px] w-[172px] items-center justify-center">
                <Ionicons color={muted} name="document-text-outline" size={30} />
              </View>
            )}
            <SlotChip slot={slot} />
            {overflow > 0 ? (
              <View className="bg-surface/80 absolute top-2.5 right-2.5 h-7 justify-center rounded-[14px] px-2.5">
                <Text className="text-foreground text-[13px] font-semibold">{`+${overflow}`}</Text>
              </View>
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
