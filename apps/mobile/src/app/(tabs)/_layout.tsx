import type {
  NativeBottomTabNavigationEventMap,
  NativeBottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs/unstable';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { withLayoutContext } from 'expo-router';
import { useThemeColor } from 'heroui-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable } from 'react-native';

import { AppearanceSettingsSheet } from '@/components/shell/appearance-settings-sheet';
import { SettingsSheetProvider, useSettingsSheet } from '@/context/settings-sheet-context';

/**
 * Detect whether the device is running iOS 26+ so we can let the system
 * handle blur/transparency automatically (Liquid Glass) instead of applying
 * a manual headerBlurEffect which conflicts with iOS 26's native behavior.
 */
function isIOS26OrLater(): boolean {
  if (Platform.OS !== 'ios') return false;
  return parseInt(Platform.Version as string, 10) >= 26;
}

const { Navigator } = createNativeBottomTabNavigator();

const NativeBottomTabs = withLayoutContext<
  NativeBottomTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  NativeBottomTabNavigationEventMap
>(Navigator);

// Settings button for the Recipes tab headerRight — reads from context
function SettingsButton() {
  const { openSettingsSheet } = useSettingsSheet();
  const [mutedColor] = useThemeColor(['muted'] as const);
  return (
    <Pressable
      onPress={openSettingsSheet}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      style={{ paddingHorizontal: 4 }}
    >
      <Ionicons name="settings-outline" size={22} color={mutedColor} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tintColor, backgroundColor] = useThemeColor(['accent', 'background'] as const);

  const openSettingsSheet = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeSettingsSheet = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const inactiveTintColor = '#737373';

  // On iOS 26+ the tab bar background adapts automatically (Liquid Glass),
  // so we only set an explicit backgroundColor on older iOS / Android.
  const tabBarStyle = useMemo(
    () =>
      isIOS26OrLater()
        ? undefined
        : { backgroundColor },
    [backgroundColor],
  );

  return (
    <SettingsSheetProvider openSettingsSheet={openSettingsSheet}>
      <NativeBottomTabs
        screenOptions={{
          tabBarActiveTintColor: tintColor,
          tabBarInactiveTintColor: inactiveTintColor,
          tabBarStyle,
          tabBarMinimizeBehavior: 'onScrollDown',
          // Enable native headers on all tabs
          headerShown: true,
          headerLargeTitleEnabled: true,
          // Make the header transparent so it floats over content.
          // On iOS this enables the blur / Liquid Glass effect; on
          // Android an opaque header looks better.
          headerTransparent: Platform.OS === 'ios',
          // Pre-iOS 26: apply an explicit blur behind the collapsed header.
          // iOS 26+ handles this automatically; setting it there breaks the
          // large title rendering.
          headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
          // Remove the bottom border / shadow under the header
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
        }}
      >
        <NativeBottomTabs.Screen
          name="index"
          options={{
            title: 'Recipes',
            headerRight: () => <SettingsButton />,
            tabBarIcon: ({ focused }) =>
              Platform.select({
                ios: {
                  type: 'sfSymbol' as const,
                  name: focused ? 'book.fill' : 'book',
                },
                default: {
                  type: 'drawableResource' as const,
                  name: 'menu_book',
                },
              })!,
          }}
        />

        <NativeBottomTabs.Screen
          name="groceries"
          options={{
            title: 'Groceries',
            tabBarIcon: ({ focused }) =>
              Platform.select({
                ios: {
                  type: 'sfSymbol' as const,
                  name: focused ? 'cart.fill' : 'cart',
                },
                default: {
                  type: 'drawableResource' as const,
                  name: 'shopping_cart',
                },
              })!,
          }}
        />

        <NativeBottomTabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ focused }) =>
              Platform.select({
                ios: {
                  type: 'sfSymbol' as const,
                  name: focused ? 'calendar.circle.fill' : 'calendar',
                },
                default: {
                  type: 'drawableResource' as const,
                  name: 'calendar_month',
                },
              })!,
          }}
        />

        <NativeBottomTabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) =>
              Platform.select({
                ios: {
                  type: 'sfSymbol' as const,
                  name: focused
                    ? 'person.crop.circle.fill'
                    : 'person.crop.circle',
                },
                default: {
                  type: 'drawableResource' as const,
                  name: 'person',
                },
              })!,
          }}
        />

        <NativeBottomTabs.Screen
          name="search"
          options={{
            title: 'Search',
            // On iOS 26+: system search tab with native search bar in header
            tabBarSystemItem: Platform.OS === 'ios' ? 'search' : undefined,
            // Android fallback: explicit icon + label
            tabBarIcon:
              Platform.OS !== 'ios'
                ? {
                    type: 'drawableResource' as const,
                    name: 'search',
                  }
                : undefined,
            tabBarLabel: Platform.OS !== 'ios' ? 'Search' : undefined,
            // Search bar lives in the header
            headerSearchBarOptions: {
              placeholder: 'Search recipes',
              autoCapitalize: 'none',
            },
          }}
        />
      </NativeBottomTabs>

      <AppearanceSettingsSheet
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        onClose={closeSettingsSheet}
      />
    </SettingsSheetProvider>
  );
}
