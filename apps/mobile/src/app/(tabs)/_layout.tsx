import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useThemeColor } from 'heroui-native';
import React, { useCallback, useMemo, useState } from 'react';

import { AppearanceSettingsSheet } from '@/components/shell/appearance-settings-sheet';
import { SettingsSheetProvider } from '@/context/settings-sheet-context';

export default function TabsLayout() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tintColor, backgroundColor] = useThemeColor(['accent', 'background']);

  const openSettingsSheet = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeSettingsSheet = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const tabIconColor = useMemo(
    () => ({
      default: '#737373',
      selected: tintColor,
    }),
    [tintColor],
  );

  return (
    <SettingsSheetProvider openSettingsSheet={openSettingsSheet}>
      <NativeTabs
        backgroundColor={backgroundColor}
        iconColor={tabIconColor}
        tintColor={tintColor}
        labelVisibilityMode="labeled"
        minimizeBehavior="onScrollDown"
      >
        <NativeTabs.Trigger name="recipes">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'book', selected: 'book.fill' }}
            md="menu_book"
          />
          <NativeTabs.Trigger.Label>Recipes</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="groceries">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'cart', selected: 'cart.fill' }}
            md="shopping_cart"
          />
          <NativeTabs.Trigger.Label>Groceries</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="calendar">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'calendar', selected: 'calendar.circle.fill' }}
            md="calendar_month"
          />
          <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person', selected: 'person.fill' }}
            md="person"
          />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="search" role="search" />
      </NativeTabs>

      <AppearanceSettingsSheet
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        onClose={closeSettingsSheet}
      />
    </SettingsSheetProvider>
  );
}
