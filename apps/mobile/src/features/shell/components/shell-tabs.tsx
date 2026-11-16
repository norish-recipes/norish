import React from "react";
import { ShellAccessory } from "@/features/shell/components/shell-accessory";
import { accessoryPlan } from "@/features/shell/utils/accessory-plan";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { useTabBarHidden } from "@/lib/tab-bar-visibility";
import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useIntl } from "react-intl";

import { useTimerStore } from "@norish/shared-react/recipes/timers";

/** The signed-in tabs: the system tab bar, Search as its own tab, the tab's add action and the timer capsule above it. */
export function ShellTabs() {
  const intl = useIntl();
  const accent = useAccentTextColor();
  const path = usePathname();
  const hidden = useTabBarHidden();
  const hasTimers = useTimerStore((state) => state.timers.length > 0);
  const plan = accessoryPlan(path, hasTimers);

  return (
    <NativeTabs hidden={hidden} minimizeBehavior="onScrollDown" tintColor={accent}>
      {hidden || !plan ? null : (
        <NativeTabs.BottomAccessory>
          <ShellAccessory plan={plan} />
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
