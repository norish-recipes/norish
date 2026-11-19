import type { TabScroll } from "@/lib/use-tab-scroll";
import React from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { IngredientIconSlots } from "@/components/ingredient-icon";
import { SheetSearchField } from "@/components/sheet-search-field";
import { TabListMarker } from "@/components/tab-list-marker";
import { TabRootHeader } from "@/components/tab-root-header";
import { homeIndicator } from "@/lib/home-indicator";
import { tabListBottomInset } from "@/lib/tab-bar-placement";
import { useIntl } from "react-intl";

import { PANTRY_INGREDIENT_NAME_MAX_LENGTH } from "@norish/shared/contracts/zod";

import type { PantryScreen } from "../hooks/use-pantry-screen";
import { ListSwitchSpace } from "./list-switch";
import { PantryRowView, PantrySkeleton } from "./pantry-rows";

/** The Groceries page's Pantry: the foods the household keeps, narrowed by its field, which only
 * filters; its title fills the bar, riding the list's scroll. The page keeps its `pantry` state. */
export function PantrySection({ scroll, pantry }: { scroll: TabScroll; pantry: PantryScreen }) {
  const intl = useIntl();
  const { rows, actions, field, isRead, isUnavailable } = pantry;
  const header = (
    <View>
      <ListSwitchSpace />
      <View className="px-5 pb-3.5">
        <SheetSearchField
          className="bg-surface focus:border-accent h-12 rounded-full border-2 border-transparent"
          label={intl.formatMessage({ id: "groceries.pantry.findPlaceholder" })}
          maxLength={PANTRY_INGREDIENT_NAME_MAX_LENGTH}
          testID="pantry-field"
          value={field.draft}
          onChange={isRead ? field.setDraft : undefined}
        />
        {field.draft.trim() === "" ? (
          <Text className="text-muted px-2 pt-2 text-sm">
            {intl.formatMessage({ id: "groceries.pantry.hint" })}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <IngredientIconSlots rows={rows}>
      <View className="bg-background flex-1" testID="pantry-screen">
        <TabRootHeader
          offset={scroll.offset}
          title={intl.formatMessage({ id: "groceries.page.pantry" })}
        />
        <TabListMarker>
          <Animated.FlatList
            ListEmptyComponent={
              isUnavailable ? (
                <Text className="text-muted px-5 py-6 text-center" testID="pantry-unavailable">
                  {intl.formatMessage({ id: "groceries.pantry.unavailable" })}
                </Text>
              ) : (
                <PantrySkeleton />
              )
            }
            ListHeaderComponent={header}
            contentContainerStyle={{ paddingBottom: tabListBottomInset(homeIndicator) }}
            contentInsetAdjustmentBehavior="automatic"
            data={isRead ? rows : []}
            keyExtractor={(row) => row.key}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <PantryRowView actions={actions} row={item} />}
            testID="pantry-list"
            onScroll={scroll.onScroll}
          />
        </TabListMarker>
      </View>
    </IngredientIconSlots>
  );
}
