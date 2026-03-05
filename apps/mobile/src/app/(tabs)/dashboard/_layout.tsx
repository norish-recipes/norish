import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useIntl } from 'react-intl';

import { SettingsMenu } from '@/components/shell/settings-menu';

export default function RecipesLayout() {
  const intl = useIntl();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLargeTitle: true,
        headerTransparent: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: intl.formatMessage({ id: 'recipes.dashboard.title' }),
          headerRight: () => <SettingsMenu />,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: intl.formatMessage({ id: 'recipes.detail.notFound' }),
          headerLargeTitle: false,
        }}
      />
    </Stack>
  );
}
