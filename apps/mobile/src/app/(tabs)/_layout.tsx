import type {
  NativeBottomTabNavigationEventMap,
  NativeBottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs/unstable';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet, Button as UIButton, Host, Menu, Picker, Text as UIText } from '@expo/ui/swift-ui';
import { tag } from '@expo/ui/swift-ui/modifiers';
import { useRouter, withLayoutContext } from 'expo-router';
import { useThemeColor } from 'heroui-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { type AppearanceMode, useAppearancePreference } from '@/context/appearance-preference-context';
import { useMobileLocaleSettings } from '@/context/mobile-i18n-context';

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

// "Add Recipe" accessory shown inline with the collapsed tab bar on iOS 26+.
// Rendered twice by the native layer (regular + inline placements) but only
// one is visible at a time. onPress is passed in so both instances share the
// same handler and keep the open state in sync.
function AddRecipeAccessory({
  placement,
  onPress,
}: {
  placement: 'regular' | 'inline';
  onPress: () => void;
}) {
  const [foregroundColor] = useThemeColor(['foreground'] as const);
  const isInline = placement === 'inline';
  return (
    <View
      style={{
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Add recipe"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="add-circle" size={isInline ? 20 : 24} color={foregroundColor} />
        <Text style={{ color: foregroundColor, fontSize: isInline ? 15 : 17, fontWeight: '600' }}>
          Add Recipe
        </Text>
      </Pressable>
    </View>
  );
}

// Native iOS menu for the Recipes tab headerRight.
// Wrapped in Host because the native header bar is a separate UIKit render
// tree — SwiftUI views require their own Host at the point of insertion.
// Contains theme picker, language picker, and a link to the Profile tab.
function SettingsMenu() {
  const router = useRouter();
  const [mutedColor] = useThemeColor(['muted'] as const);
  const { mode, setMode } = useAppearancePreference();
  const { locale, enabledLocales, localeNames, isLoading, setLocale } = useMobileLocaleSettings();

  return (
    <Host>
      <Menu
        label={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            style={{ paddingHorizontal: 4 }}
          >
            <Ionicons name="settings-outline" size={22} color={mutedColor} />
          </Pressable>
        }
      >
        <Picker
          label="Theme"
          systemImage="circle.lefthalf.filled"
          selection={mode}
          onSelectionChange={(value) => setMode(value as AppearanceMode)}
        >
          <UIText modifiers={[tag('system')]}>System</UIText>
          <UIText modifiers={[tag('light')]}>Light</UIText>
          <UIText modifiers={[tag('dark')]}>Dark</UIText>
        </Picker>

        {!isLoading && enabledLocales.length > 1 && (
          <Picker
            label="Language"
            systemImage="globe"
            selection={locale}
            onSelectionChange={(value) => setLocale(value as string)}
          >
            {enabledLocales.map((l) => (
              <UIText key={l.code} modifiers={[tag(l.code)]}>
                {localeNames[l.code] ?? l.code}
              </UIText>
            ))}
          </Picker>
        )}

        <UIButton
          label="Profile"
          systemImage="person.crop.circle"
          onPress={() => router.push('/(tabs)/profile')}
        />
      </Menu>
    </Host>
  );
}

export default function TabsLayout() {
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [tintColor, backgroundColor] = useThemeColor(['accent', 'background'] as const);

  const openAddRecipeSheet = useCallback(() => {
    setIsAddRecipeOpen(true);
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
    <View style={{ flex: 1 }}>
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
            headerRight: () => <SettingsMenu />,
            // iOS 26+ only — silently no-ops on older versions
            bottomAccessory: ({ placement }) => (
              <AddRecipeAccessory placement={placement} onPress={openAddRecipeSheet} />
            ),
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

      <Host>
        <BottomSheet
          isPresented={isAddRecipeOpen}
          onIsPresentedChange={setIsAddRecipeOpen}
          fitToContents
        >
          <Text>Add Recipe</Text>
        </BottomSheet>
      </Host>
    </View>
  );
}
