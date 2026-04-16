import React, { useCallback, useState } from "react";
import { Platform } from "react-native";
import { AddRecipeSheet } from "@/components/shell/sheet/add-recipe-sheet";
import { TabAccessoryContent } from "@/components/shell/tab-bottom-accessory";
import { useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useThemeColor } from "heroui-native";

/**
 * Detect whether the device is running iOS 26+ so we can let the system
 * handle blur/transparency automatically (Liquid Glass) instead of applying
 * a manual blurEffect which conflicts with iOS 26's native behavior.
 */
function isIOS26OrLater(): boolean {
  if (Platform.OS !== "ios") return false;
  return parseInt(Platform.Version as string, 10) >= 26;
}

// Which tab the user is currently on, based on URL segments.
// segments[1] is the tab name inside (tabs): 'dashboard' | 'groceries' | 'search' | etc.
type ActiveTab = "dashboard" | "groceries" | "search" | "calendar" | "profile";

function useActiveTab(): { tab: ActiveTab; isRecipeDetail: boolean } {
  const segments = useSegments();
  // segments[0] = '(tabs)', segments[1] = tab name
  const tab = (segments[1] as ActiveTab | undefined) ?? "dashboard";
  // segments[2] = 'recipe' when on /(tabs)/dashboard/recipe/[id]
  const isRecipeDetail = tab === "dashboard" && segments[2] === "recipe";
  return { tab, isRecipeDetail };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function TabsLayout() {
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [tintColor, backgroundColor] = useThemeColor(["accent", "background"] as const);

  const { tab: activeTab, isRecipeDetail } = useActiveTab();

  // Hide the bottom accessory on recipe detail pages
  const accessoryMode: "recipe" | "grocery" | "hidden" = isRecipeDetail
    ? "hidden"
    : activeTab === "dashboard" || activeTab === "search"
      ? "recipe"
      : activeTab === "groceries"
        ? "grocery"
        : "hidden";

  const openAddRecipeSheet = useCallback(() => setIsAddRecipeOpen(true), []);

  // Grocery add — placeholder, wired to a no-op until the groceries feature is built
  const openAddGrocerySheet = useCallback(() => {
    // TODO: open add-grocery flow
  }, []);

  // On iOS 26+ the tab bar background adapts automatically (Liquid Glass).
  const tabBarBackgroundColor = isIOS26OrLater() ? undefined : backgroundColor;

  // Pre-iOS 26: apply an explicit blur. iOS 26+ handles this automatically.
  const blurEffect = isIOS26OrLater() ? undefined : ("regular" as const);

  return (
    <>
      <NativeTabs
        tintColor={tintColor}
        backgroundColor={tabBarBackgroundColor}
        minimizeBehavior="onScrollDown"
        blurEffect={blurEffect}
      >
        {accessoryMode !== "hidden" && (
          <NativeTabs.BottomAccessory>
            <TabAccessoryContent
              mode={accessoryMode}
              onPressRecipe={openAddRecipeSheet}
              onPressGrocery={openAddGrocerySheet}
            />
          </NativeTabs.BottomAccessory>
        )}

        {/* Recipes tab */}
        <NativeTabs.Trigger name="dashboard">
          <NativeTabs.Trigger.Icon sf={{ default: "book", selected: "book.fill" }} md="menu_book" />
          <NativeTabs.Trigger.Label>Recipes</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        {/* Groceries tab */}
        <NativeTabs.Trigger name="groceries">
          <NativeTabs.Trigger.Icon
            sf={{ default: "cart", selected: "cart.fill" }}
            md="shopping_cart"
          />
          <NativeTabs.Trigger.Label>Groceries</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        {/* Calendar tab */}
        <NativeTabs.Trigger name="calendar">
          <NativeTabs.Trigger.Icon
            sf={{ default: "calendar", selected: "calendar.circle.fill" }}
            md="calendar_month"
          />
          <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        {/* Profile tab */}
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon
            sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
            md="person"
          />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        {/* Search tab — system search role on iOS, plain icon on Android */}
        <NativeTabs.Trigger name="search" role={Platform.OS === "ios" ? "search" : undefined}>
          <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      {/* Add Recipe sheet — sibling of NativeTabs so it overlays the tab bar */}
      <AddRecipeSheet isPresented={isAddRecipeOpen} onIsPresentedChange={setIsAddRecipeOpen} />
    </>
  );
}
