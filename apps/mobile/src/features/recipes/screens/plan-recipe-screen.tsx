import React, { useDeferredValue, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CardPhoto } from "@/components/card-photo";
import { Sheet, SheetList, SheetStrip } from "@/components/sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { Button, SearchField, Skeleton, Spinner, Tabs, useThemeColor } from "heroui-native";
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

import { usePlanExit } from "../hooks/use-plan-exit";
import { planDay } from "../utils/plan-day";

/** The days offered, today first. */
const DAYS = 14;
const SKELETON_ROWS = [0, 1, 2, 3];

const asSlot = (value: string | undefined): Slot =>
  TODAY_MEAL_SLOTS.find((slot) => slot === value) ?? "Dinner";

/** Plan a recipe: a day, a slot, then a recipe from the search, a random one or a note. */
export function PlanRecipeScreen() {
  const intl = useIntl();
  const params = useLocalSearchParams<{ slot?: string }>();
  const [foreground] = useThemeColor(["foreground"] as const);
  const today = parseDateKey(useToday());
  const days = Array.from(
    { length: DAYS },
    (_, offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
  );
  const [picked, setPicked] = useState<Date | null>(null);
  const date = planDay(picked, days);
  const [slot, setSlot] = useState(() => asSlot(params.slot));
  const [input, setInput] = useState("");
  const search = useDeferredValue(input.trim());
  const { recipes, isLoading, error, loadMore } = useRecipesQuery({ search: search || undefined });
  const { getRandomRecipe } = useRandomRecipe();
  const exit = usePlanExit();
  const { isRandomLoading, planRecipe, planRandom, planNote } = useSlotPlanning({
    date,
    slot,
    getRandomRecipe,
    close: exit,
  });

  useRecipeListSubscription();

  const hasNote = input.trim().length > 0;
  const first = error && recipes.length === 0 ? "rounded-[22px]" : "rounded-t-[22px]";

  const header = (
    <View className="gap-3">
      {/* heroui-native has no day strip, so these chips are hand-built. */}
      <SheetStrip
        accessibilityLabel={intl.formatMessage({ id: "calendar.panel.addToCalendar" })}
        contentClassName="gap-2"
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
              className={`h-16 w-[52px] items-center justify-center gap-0.5 rounded-[18px] ${selected ? "bg-accent" : "bg-default"}`}
              testID={`plan-recipe-day-${offset}`}
              onPress={() => setPicked(day)}
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
      </SheetStrip>

      <Tabs value={slot} onValueChange={(next) => setSlot(asSlot(next))}>
        <Tabs.List className="bg-default h-10 rounded-full p-[3px]">
          <Tabs.Indicator className="bg-surface rounded-full" />
          {TODAY_MEAL_SLOTS.map((target) => (
            <Tabs.Trigger
              key={target}
              className="h-[34px] flex-1 px-0"
              testID={`plan-recipe-slot-${target}`}
              value={target}
            >
              <Tabs.Label className="text-sm font-medium" numberOfLines={1}>
                {intl.formatMessage({ id: `common.slots.${slotTranslationKeys[target]}` })}
              </Tabs.Label>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>

      <SearchField value={input} onChange={setInput}>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            accessibilityLabel={intl.formatMessage({ id: "calendar.panel.searchOrAddNote" })}
            autoCorrect={false}
            className="bg-default h-12 rounded-3xl"
            placeholder={intl.formatMessage({ id: "calendar.panel.searchOrAddNote" })}
            returnKeyType="search"
            testID="plan-recipe-search"
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <View className={`bg-default ${first}`}>
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
      </View>
    </View>
  );

  return (
    <Sheet name="plan-recipe" title={intl.formatMessage({ id: "calendar.panel.planRecipe" })}>
      <SheetList
        ListEmptyComponent={
          error ? undefined : (
            <View className="bg-default border-separator rounded-b-[22px] border-t">
              {isLoading ? (
                SKELETON_ROWS.map((row) => (
                  <View key={row} className="flex-row items-center gap-3 px-3.5 py-2.5">
                    <Skeleton className="size-11 rounded-xl" />
                    <Skeleton className="h-4 w-40 rounded-md" />
                  </View>
                ))
              ) : (
                <Text className="text-muted p-4 text-base">
                  {intl.formatMessage({ id: "calendar.panel.noRecipesFound" })}
                </Text>
              )}
            </View>
          )
        }
        ListHeaderComponent={header}
        data={recipes}
        keyExtractor={(recipe) => recipe.id}
        renderItem={({ item: recipe, index }) => (
          <Button
            accessibilityLabel={recipe.name}
            className={`border-separator bg-default h-auto justify-start gap-3 rounded-none border-t px-3.5 py-2.5 ${index === recipes.length - 1 ? "rounded-b-[22px]" : ""}`}
            testID={`plan-recipe-${recipe.id}`}
            variant="ghost"
            onPress={() => planRecipe(recipe, slot)}
          >
            <CardPhoto className="size-11 rounded-xl" image={recipe.image} onSheet />
            <Text className="text-foreground flex-1 text-base" numberOfLines={1}>
              {recipe.name}
            </Text>
            <View className="bg-surface size-8 items-center justify-center rounded-full">
              <Ionicons color={foreground} name="add" size={17} />
            </View>
          </Button>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
      />
    </Sheet>
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
    <Button
      className="h-auto justify-start gap-3 rounded-none px-3.5 py-2.5"
      isDisabled={busy}
      testID={testID}
      variant="ghost"
      onPress={onPress}
    >
      <View className="bg-surface size-11 items-center justify-center rounded-xl">
        {busy ? <Spinner size="sm" /> : <Ionicons color={accent} name={icon} size={20} />}
      </View>
      <Text className="text-foreground flex-1 text-base font-medium" numberOfLines={1}>
        {label}
      </Text>
    </Button>
  );
}
