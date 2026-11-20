import React, { useEffect, useState } from "react";
import { ShellAccessory } from "@/features/shell/components/shell-accessory";
import {
  accessoryPlan,
  accessoryScreen,
  shellTab,
  tabPage,
} from "@/features/shell/utils/accessory-plan";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { useOwnerRights } from "@/hooks/use-owner-rights";
import { useGroceriesSection } from "@/lib/groceries-section";
import { useLibraryLens } from "@/lib/library-lens";
import { useShownRecipe } from "@/lib/shown-recipe";
import { TabAccessoryPlacementProbe } from "@/lib/tab-accessory-placement";
import { useTabBarHidden } from "@/lib/tab-bar-visibility";
import { cookbookIdOf, recipeIdOf, TAB_ROUTES } from "@/lib/tab-routes";
import { usePathname, useSegments } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useIntl } from "react-intl";

import { useCookbookQuery, useRecipeQuery } from "@norish/shared-react/recipes";
import { useTimerStore } from "@norish/shared-react/recipes/timers";

// Longer than UIKit's tab switch, which applies a minimise behaviour changed within it only after.
const TAB_SWITCH_MS = 400;

/** The signed-in tabs: the system tab bar, Search as its own tab, the tab's add action and the timer capsule above it. */
export function ShellTabs() {
  const intl = useIntl();
  const accent = useAccentTextColor();
  const path = usePathname();
  const hidden = useTabBarHidden();
  const hasTimers = useTimerStore((state) => state.timers.length > 0);
  // A root sheet (the timers, Add recipe, the editor) is outside the tabs, over the page it opened on.
  const segments = useSegments();
  const onTab = segments[0] === "(tabs)";
  // Search's pages are the Recipes tab's routes, told apart by the stack they are in.
  const group: string | undefined = segments.at(1);
  const inSearchNow = group === "(search)";
  const [lastTabPage, setLastTabPage] = useState(onTab ? path : TAB_ROUTES.recipes.root);
  const [lastInSearch, setLastInSearch] = useState(onTab && inSearchNow);
  const inSearch = onTab ? inSearchNow : lastInSearch;
  const page = tabPage(path, onTab, lastTabPage);
  const recipeId = recipeIdOf(page);
  // A link straight to a recipe has the list under it.
  const [lastNonRecipePath, setLastNonRecipePath] = useState(() =>
    recipeId ? TAB_ROUTES.recipes.root : page
  );
  const shown = useShownRecipe();
  const lens = useLibraryLens();
  const groceries = useGroceriesSection();
  const { recipe } = useRecipeQuery(shown);
  // A loading or missing recipe keeps the last other screen's action.
  const screen = accessoryScreen(
    page,
    recipeId,
    lastNonRecipePath,
    recipe ? shown : null,
    inSearch
  );
  const { cookbook } = useCookbookQuery(cookbookIdOf(screen.path) ?? "");
  const { canEdit } = useOwnerRights();
  const plan = accessoryPlan(
    screen,
    hasTimers,
    lens,
    cookbook && canEdit(cookbook) ? cookbook.id : null,
    groceries
  );
  const tab = shellTab(page, inSearch);
  // UIKit keeps one minimised state for every tab: a switch holds the bar expanded through the
  // switch, after which it follows the new tab's list.
  const [barTab, setBarTab] = useState(tab);

  useEffect(() => {
    const settle = setTimeout(() => setBarTab(tab), TAB_SWITCH_MS);

    return () => clearTimeout(settle);
  }, [tab]);

  if (page !== lastTabPage) setLastTabPage(page);
  if (inSearch !== lastInSearch) setLastInSearch(inSearch);
  if (!recipeId && page !== lastNonRecipePath) setLastNonRecipePath(page);

  return (
    <NativeTabs
      hidden={hidden}
      minimizeBehavior={tab === barTab ? "onScrollDown" : "never"}
      tintColor={accent}
    >
      {hidden || (!plan.add && !hasTimers) ? null : (
        <NativeTabs.BottomAccessory>
          <ShellAccessory plan={plan} />
          {/* Rendered twice (a regular and an inline copy), both in the one accessory: each reads its
           * shared trait, so the two report the same placement together. */}
          <TabAccessoryPlacementProbe />
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
      <NativeTabs.Trigger name="(search)" role="search" testID="tab-search">
        <NativeTabs.Trigger.Label>
          {intl.formatMessage({ id: "common.actions.search" })}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
