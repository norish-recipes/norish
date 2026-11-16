import React, { useState } from "react";
import { ShellAccessory } from "@/features/shell/components/shell-accessory";
import { accessoryPlan, shownPath } from "@/features/shell/utils/accessory-plan";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { useShownRecipe } from "@/lib/shown-recipe";
import { useTabBarHidden } from "@/lib/tab-bar-visibility";
import { recipeIdOf, TAB_ROUTES } from "@/lib/tab-routes";
import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useIntl } from "react-intl";

import { useRecipeQuery } from "@norish/shared-react/recipes";
import { useTimerStore } from "@norish/shared-react/recipes/timers";

/** The signed-in tabs: the system tab bar, Search as its own tab, the tab's add action and the timer capsule above it. */
export function ShellTabs() {
  const intl = useIntl();
  const accent = useAccentTextColor();
  const path = usePathname();
  const hidden = useTabBarHidden();
  const hasTimers = useTimerStore((state) => state.timers.length > 0);
  // A link straight to a recipe has the list under it.
  const [below, setBelow] = useState(() => (recipeIdOf(path) ? TAB_ROUTES.recipes.root : path));
  const shown = useShownRecipe();
  const { recipe } = useRecipeQuery(shown);
  // A loading or missing recipe keeps the action of the screen below.
  const labelled = shownPath(path, below, recipe ? shown : null);
  const plan = accessoryPlan(labelled, hasTimers);

  if (!recipeIdOf(path) && path !== below) setBelow(path);

  return (
    <NativeTabs hidden={hidden} minimizeBehavior="onScrollDown" tintColor={accent}>
      {hidden || !plan ? null : (
        <NativeTabs.BottomAccessory>
          <ShellAccessory path={labelled} plan={plan} />
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
