import React from "react";
import { AddRecipeAccessory } from "@/features/shell/components/add-recipe-accessory";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { NativeTabs } from "expo-router/native-tabs";
import { useIntl } from "react-intl";

/** The signed-in tabs: the system tab bar, Search as its own tab, Add recipe above it. */
export function ShellTabs() {
  const intl = useIntl();
  const accent = useAccentTextColor();

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={accent}>
      <NativeTabs.BottomAccessory>
        <AddRecipeAccessory />
      </NativeTabs.BottomAccessory>
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
