import React from "react";
import { View } from "react-native";
import { DestructiveMenuButton } from "@/components/destructive-menu-button";
import { Button, Divider, Host, Menu, Section, Toggle } from "@expo/ui/swift-ui";
import { buttonBorderShape, buttonStyle, labelStyle } from "@expo/ui/swift-ui/modifiers";
import { useIntl } from "react-intl";

import type { GroceryViewMode } from "@norish/shared/contracts/zod/device-preferences";

/** The gear: view mode, grouping and Clear list, in iOS's own menu on a glass circle. */
export function ListSettingsMenu({
  view,
  grouped,
  canClear,
  onView,
  onGrouped,
  onClear,
}: {
  view: GroceryViewMode;
  grouped: boolean;
  canClear: boolean;
  onView: (view: GroceryViewMode) => void;
  onGrouped: (grouped: boolean) => void;
  onClear: () => void;
}) {
  const intl = useIntl();
  const text = (id: string) => intl.formatMessage({ id });

  return (
    <View testID="groceries-settings">
      <Host matchContents>
        <Menu
          label={text("groceries.mobile.listSettings")}
          modifiers={[buttonStyle("glass"), buttonBorderShape("circle"), labelStyle("iconOnly")]}
          systemImage="gearshape"
        >
          <Section title={text("groceries.mobile.viewMode")}>
            <Button
              label={text("groceries.mobile.viewByStore")}
              systemImage={view === "store" ? "checkmark" : undefined}
              onPress={() => onView("store")}
            />
            <Button
              label={text("groceries.mobile.viewByRecipe")}
              systemImage={view === "recipe" ? "checkmark" : undefined}
              onPress={() => onView("recipe")}
            />
          </Section>
          {view === "store" ? (
            <Toggle
              isOn={grouped}
              label={text("groceries.page.groupIngredients")}
              onIsOnChange={onGrouped}
            />
          ) : null}
          {canClear ? (
            <>
              <Divider />
              <DestructiveMenuButton
                label={text("groceries.page.clearList")}
                systemImage="trash"
                onPress={onClear}
              />
            </>
          ) : null}
        </Menu>
      </Host>
    </View>
  );
}
