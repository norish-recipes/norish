import React from "react";
import { AddGroceriesAccessory } from "@/features/shell/components/add-groceries-accessory";
import { AddRecipeAccessory } from "@/features/shell/components/add-recipe-accessory";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { useTabBarHidden } from "@/lib/tab-bar-visibility";
import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useIntl } from "react-intl";

/** The signed-in tabs: the system tab bar, Search as its own tab, Add recipe (Add items on Groceries) above it. */
export function ShellTabs() {
  const intl = useIntl();
  const accent = useAccentTextColor();
  const hidden = useTabBarHidden();
  const path = usePathname();
  // The Pantry (and its food sheet) draws no accessory: nothing is added to the list from there.
  const onPantry = path.startsWith("/groceries/pantry") || path.startsWith("/groceries/food");
  const onGroceries = path.startsWith("/groceries");

  return (
    <NativeTabs hidden={hidden} minimizeBehavior="onScrollDown" tintColor={accent}>
      {hidden || onPantry ? null : (
        <NativeTabs.BottomAccessory>
          {onGroceries ? <AddGroceriesAccessory /> : <AddRecipeAccessory />}
        </NativeTabs.BottomAccessory>
      )}
      <NativeTabs.Trigger disableAutomaticContentInsets name="(recipes)" testID="tab-recipes">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>
          {intl.formatMessage({ id: "navbar.nav.home" })}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="groceries" testID="tab-groceries">
        <NativeTabs.Trigger.Icon sf={{ default: "cart", selected: "cart.fill" }} />
        <NativeTabs.Trigger.Label>
          {intl.formatMessage({ id: "navbar.nav.groceries" })}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar" testID="tab-calendar">
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} />
        <NativeTabs.Trigger.Label>
          {intl.formatMessage({ id: "navbar.nav.calendar" })}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" testID="tab-settings">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>
          {intl.formatMessage({ id: "navbar.userMenu.settings.title" })}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search" testID="tab-search">
        <NativeTabs.Trigger.Label>
          {intl.formatMessage({ id: "common.actions.search" })}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
