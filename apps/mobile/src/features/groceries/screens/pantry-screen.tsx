import React from "react";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IngredientIconSlots } from "@/components/ingredient-icon";
import { tabListBottomInset } from "@/components/tab-list-inset";
import { TitleRow } from "@/components/title-row";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { FindField } from "../components/find-field";
import { ListSwitch } from "../components/list-switch";
import { PantryRowView, PantrySkeleton } from "../components/pantry-rows";
import { usePantryScreen } from "../hooks/use-pantry-screen";

/** The Pantry: the foods the household keeps, narrowed and added to from one field. */
export function PantryScreen() {
  const intl = useIntl();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rows, actions, field, isRead, isUnavailable } = usePantryScreen();
  const header = (
    <View>
      <TitleRow className="pb-5" title={intl.formatMessage({ id: "groceries.page.pantry" })}>
        <ListSwitch
          value="pantry"
          onChange={(value) => value === "list" && router.dismissTo(TAB_ROUTES.groceries.root)}
        />
      </TitleRow>
      <View className="px-5 pb-3.5">
        {/* Drawn while the Pantry loads but taking nothing: a food added then could double one kept. */}
        <FindField
          canAdd={field.canAdd}
          disabled={!isRead}
          fieldRef={field.ref}
          value={field.draft}
          onAdd={field.add}
          onChange={field.setDraft}
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
        <FlatList
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
          contentContainerStyle={{ paddingBottom: tabListBottomInset(insets.bottom) }}
          contentInsetAdjustmentBehavior="never"
          data={isRead ? rows : []}
          keyExtractor={(row) => row.key}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <PantryRowView actions={actions} row={item} />}
          testID="pantry-list"
        />
        {/* Rows dissolve into the page colour before the tab bar. */}
        <View
          className="to-background from-background/0 absolute inset-x-0 bottom-0 h-[190px] bg-linear-to-b to-75%"
          pointerEvents="none"
        />
      </View>
    </IngredientIconSlots>
  );
}
