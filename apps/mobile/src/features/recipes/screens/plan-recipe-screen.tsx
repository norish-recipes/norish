import React, { useDeferredValue, useState } from "react";
import { Text, View } from "react-native";
import { CardPhoto } from "@/components/card-photo";
import { formatDay } from "@/components/day-card";
import { GlassIconBadge } from "@/components/glass";
import { Loader } from "@/components/loader";
import { MoveFields } from "@/components/move-fields";
import { Sheet, SheetList } from "@/components/sheet";
import { SheetSearchField } from "@/components/sheet-search-field";
import { asSlot } from "@/components/slot-tabs";
import { stripDays } from "@/lib/strip-days";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { Button, Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useSlotPlanning } from "@norish/shared-react/calendar";
import { useToday } from "@norish/shared-react/reader";
import {
  useRandomRecipe,
  useRecipeListSubscription,
  useRecipesQuery,
} from "@norish/shared-react/recipes";
import { parseDateKey } from "@norish/shared/lib/helpers";

import { usePlanExit } from "../hooks/use-plan-exit";

const SKELETON_ROWS = [0, 1, 2, 3];

/** Plan a recipe: a day (strip or date chip), a slot, then a recipe from the search, a random one
 * or a note. Opened on one day (`date`) it is that day's add, without the strip. */
export function PlanRecipeScreen() {
  const intl = useIntl();
  const params = useLocalSearchParams<{ slot?: string; date?: string }>();
  const today = useToday();
  const day = params.date ?? null;
  const days = stripDays(today);
  const [picked, setPicked] = useState<{ day: string; fromStrip: boolean } | null>(null);
  // Today until a day is picked; a strip day that midnight took off the strip is today again.
  const stripped = picked?.fromStrip && !days.includes(picked.day);
  const date = day ?? (picked && !stripped ? picked.day : today);
  const [slot, setSlot] = useState(() => asSlot(params.slot));
  const [input, setInput] = useState("");
  const search = useDeferredValue(input.trim());
  const { recipes, isLoading, error, loadMore } = useRecipesQuery({ search: search || undefined });
  const { getRandomRecipe } = useRandomRecipe();
  const exit = usePlanExit();
  const { isRandomLoading, planRecipe, planRandom, planNote } = useSlotPlanning({
    date: parseDateKey(date),
    slot,
    getRandomRecipe,
    close: exit,
  });

  useRecipeListSubscription();

  const hasNote = input.trim().length > 0;
  const first = error && recipes.length === 0 ? "rounded-[22px]" : "rounded-t-[22px]";

  const header = (
    <View className="gap-3">
      <MoveFields
        date={date}
        days={!day}
        slot={slot}
        testID="plan-recipe"
        onDateChange={(next, fromStrip) => setPicked({ day: next, fromStrip })}
        onSlotChange={setSlot}
      />

      <SheetSearchField
        label={intl.formatMessage({ id: "calendar.panel.searchOrAddNote" })}
        testID="plan-recipe-search"
        value={input}
        onChange={setInput}
      />

      <View className={`bg-fill ${first}`}>
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
    <Sheet
      name="plan-recipe"
      title={
        day
          ? intl.formatMessage(
              { id: "calendar.panel.addToDay" },
              { day: formatDay(intl, parseDateKey(day)) }
            )
          : intl.formatMessage({ id: "calendar.mobile.planRecipe" })
      }
    >
      <SheetList
        ListEmptyComponent={
          error ? undefined : (
            <View className="bg-fill border-separator rounded-b-[22px] border-t">
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
            className={`border-separator bg-fill h-auto justify-start gap-3 rounded-none border-t px-3.5 py-2.5 ${index === recipes.length - 1 ? "rounded-b-[22px]" : ""}`}
            testID={`plan-recipe-${recipe.id}`}
            variant="ghost"
            onPress={() => planRecipe(recipe, slot)}
          >
            <CardPhoto className="size-11 rounded-xl" image={recipe.image} onSheet />
            <Text className="text-foreground flex-1 text-base" numberOfLines={1}>
              {recipe.name}
            </Text>
            <GlassIconBadge symbol="plus" />
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
      <View className="bg-fill size-11 items-center justify-center rounded-xl">
        {busy ? <Loader /> : <Ionicons color={accent} name={icon} size={20} />}
      </View>
      <Text className="text-foreground flex-1 text-base font-medium" numberOfLines={1}>
        {label}
      </Text>
    </Button>
  );
}
