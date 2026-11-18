import React from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { IngredientIconSlots } from "@/components/ingredient-icon";
import { SheetSearchField } from "@/components/sheet-search-field";
import { TabListMarker } from "@/components/tab-list-marker";
import { TabRootHeader } from "@/components/tab-root-header";
import { tabListBottomInset } from "@/lib/tab-bar-placement";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useTabScroll } from "@/lib/use-tab-scroll";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { PANTRY_INGREDIENT_NAME_MAX_LENGTH } from "@norish/shared/contracts/zod";

import { ListSwitch } from "../components/list-switch";
import { PantryRowView, PantrySkeleton } from "../components/pantry-rows";
import { usePantryScreen } from "../hooks/use-pantry-screen";

/** The Pantry: the foods the household keeps, narrowed by its field, which only filters. */
export function PantryScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { rows, actions, field, isRead, isUnavailable } = usePantryScreen();
  const scroll = useTabScroll();
  const header = (
    <View>
      <View className="px-5 pb-5">
        <ListSwitch
          value="pantry"
          onChange={(value) => value === "list" && router.dismissTo(TAB_ROUTES.groceries.root)}
        />
      </View>
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
            contentContainerStyle={{ paddingBottom: tabListBottomInset(scroll.homeIndicator) }}
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
        {/* Rows dissolve into the page colour before the tab bar. */}
        <View
          className="to-background from-background/0 absolute inset-x-0 bottom-0 h-[190px] bg-linear-to-b to-75%"
          pointerEvents="none"
        />
      </View>
    </IngredientIconSlots>
  );
}
