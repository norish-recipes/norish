import React, { useDeferredValue, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { Slot } from "@norish/shared/contracts";
import { useSlotPlanning } from "@norish/shared-react/calendar";
import { slotTranslationKeys, TODAY_MEAL_SLOTS } from "@norish/shared-react/calendar/todays-meals";
import { useToday } from "@norish/shared-react/reader";
import {
  useRandomRecipe,
  useRecipeListSubscription,
  useRecipesQuery,
} from "@norish/shared-react/recipes";
import { parseDateKey } from "@norish/shared/lib/helpers";

import { CardPhoto } from "../components/card-photo";

/** The days offered, today first. */
const DAYS = 14;
const SCROLL_END_MARGIN = 240;

const asSlot = (value: string | undefined): Slot =>
  TODAY_MEAL_SLOTS.find((slot) => slot === value) ?? "Dinner";

/** Plan a recipe: a day, a slot, then a recipe from the search, a random one or a note. */
export function PlanRecipeScreen() {
  const intl = useIntl();
  const router = useRouter();
  const params = useLocalSearchParams<{ slot?: string }>();
  const [foreground, muted] = useThemeColor(["foreground", "muted"] as const);
  const today = parseDateKey(useToday());
  const days = Array.from(
    { length: DAYS },
    (_, offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
  );
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState(() => asSlot(params.slot));
  const [input, setInput] = useState("");
  const search = useDeferredValue(input.trim());
  const { recipes, isLoading, error, loadMore } = useRecipesQuery({ search: search || undefined });
  const { getRandomRecipe } = useRandomRecipe();
  const { isRandomLoading, planRecipe, planRandom, planNote } = useSlotPlanning({
    date,
    slot,
    getRandomRecipe,
    close: () => router.back(),
    // ponytail: after-planning (open or add groceries) arrives with the plan and groceries sheets.
    onPlanned: () => {},
  });

  useRecipeListSubscription();

  const slotLabel = (target: Slot) =>
    intl.formatMessage({ id: `common.slots.${slotTranslationKeys[target]}` });
  const hasNote = input.trim().length > 0;

  return (
    // react-native-screens sizes only a ScrollView that sits directly in the sheet.
    <ScrollView
      contentContainerClassName="gap-3 px-5 pt-5 pb-8"
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={64}
      showsVerticalScrollIndicator={false}
      testID="plan-recipe-sheet"
      onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
        if (contentOffset.y + layoutMeasurement.height > contentSize.height - SCROLL_END_MARGIN) {
          loadMore();
        }
      }}
    >
      <View className="flex-row items-center justify-between pl-2">
        <Text className="text-foreground text-[22px] font-semibold">
          {intl.formatMessage({ id: "calendar.panel.planRecipe" })}
        </Text>
        <Pressable
          accessibilityLabel={intl.formatMessage({ id: "common.actions.close" })}
          accessibilityRole="button"
          className="bg-surface size-10 items-center justify-center rounded-full"
          testID="plan-recipe-close"
          onPress={() => router.back()}
        >
          <Ionicons color={foreground} name="close" size={20} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        accessibilityLabel={intl.formatMessage({ id: "calendar.panel.addToCalendar" })}
        className="-mx-5"
        contentContainerClassName="gap-2 px-5"
        showsHorizontalScrollIndicator={false}
        testID="plan-recipe-days"
      >
        {days.map((day, offset) => {
          const selected = day.getTime() === date.getTime();
          const label =
            offset === 0
              ? intl.formatMessage({ id: "calendar.mobile.today" })
              : intl.formatDate(day, { weekday: "short" });

          return (
            <Pressable
              key={day.getTime()}
              accessibilityLabel={intl.formatDate(day, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              className={`h-16 w-[52px] items-center justify-center gap-0.5 rounded-[18px] ${selected ? "bg-accent" : "bg-surface"}`}
              testID={`plan-recipe-day-${offset}`}
              onPress={() => setDate(day)}
            >
              <Text
                className={`text-xs font-medium ${selected ? "text-accent-foreground" : "text-foreground"}`}
              >
                {label}
              </Text>
              <Text
                className={`text-[19px] font-semibold ${selected ? "text-accent-foreground" : "text-foreground"}`}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        accessibilityRole="radiogroup"
        className="bg-default flex-row gap-0.5 rounded-full p-[3px]"
      >
        {TODAY_MEAL_SLOTS.map((target) => (
          <Pressable
            key={target}
            accessibilityRole="radio"
            accessibilityState={{ checked: slot === target }}
            className={`h-[34px] flex-1 items-center justify-center rounded-full ${slot === target ? "bg-surface" : ""}`}
            testID={`plan-recipe-slot-${target}`}
            onPress={() => setSlot(target)}
          >
            <Text
              className={`text-sm font-medium ${slot === target ? "text-foreground" : "text-muted"}`}
              numberOfLines={1}
            >
              {slotLabel(target)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="bg-surface h-12 flex-row items-center gap-2.5 rounded-3xl px-4">
        <Ionicons color={muted} name="search" size={18} />
        <TextInput
          accessibilityLabel={intl.formatMessage({ id: "calendar.panel.searchOrAddNote" })}
          autoCorrect={false}
          className="text-foreground flex-1 text-base"
          placeholder={intl.formatMessage({ id: "calendar.panel.searchOrAddNote" })}
          placeholderTextColor={muted}
          returnKeyType="search"
          testID="plan-recipe-search"
          value={input}
          onChangeText={setInput}
        />
      </View>

      <View className="bg-surface overflow-hidden rounded-[22px]">
        {hasNote ? (
          <ActionRow
            icon="document-text-outline"
            label={intl.formatMessage({ id: "calendar.panel.addNote" }, { input: input.trim() })}
            testID="plan-recipe-note"
            onPress={() => planNote(input)}
          />
        ) : (
          <ActionRow
            busy={isRandomLoading}
            icon="dice-outline"
            label={intl.formatMessage({ id: "calendar.panel.random" })}
            testID="plan-recipe-random"
            onPress={() => void planRandom()}
          />
        )}
        {error ? (
          <Text className="text-danger border-separator border-t p-4 text-base">
            {intl.formatMessage({ id: "calendar.panel.failedToLoadRecipes" })}
          </Text>
        ) : null}
        {recipes.map((recipe) => (
          <Pressable
            key={recipe.id}
            accessibilityLabel={recipe.name}
            accessibilityRole="button"
            className="border-separator flex-row items-center gap-3 border-t px-3.5 py-2.5"
            testID={`plan-recipe-${recipe.id}`}
            onPress={() => planRecipe(recipe, slot)}
          >
            <CardPhoto className="size-11 rounded-xl" image={recipe.image} />
            <Text className="text-foreground flex-1 text-base" numberOfLines={1}>
              {recipe.name}
            </Text>
            <View className="bg-default size-8 items-center justify-center rounded-full">
              <Ionicons color={foreground} name="add" size={17} />
            </View>
          </Pressable>
        ))}
        {isLoading && recipes.length === 0 ? <Spinner className="py-4" /> : null}
        {!isLoading && !error && recipes.length === 0 ? (
          <Text className="text-muted border-separator border-t p-4 text-base">
            {intl.formatMessage({ id: "calendar.panel.noRecipesFound" })}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function ActionRow({
  icon,
  label,
  busy,
  testID,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  busy?: boolean;
  testID: string;
  onPress: () => void;
}) {
  const [accent] = useThemeColor(["accent"] as const);

  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-3 px-3.5 py-2.5"
      disabled={busy}
      testID={testID}
      onPress={onPress}
    >
      <View className="bg-default size-11 items-center justify-center rounded-xl">
        {busy ? <Spinner size="sm" /> : <Ionicons color={accent} name={icon} size={20} />}
      </View>
      <Text className="text-foreground flex-1 text-base font-medium" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
