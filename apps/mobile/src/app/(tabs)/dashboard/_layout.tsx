import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { SettingsMenu } from '@/components/shell/settings-menu';

export default function RecipesLayout() {
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
          title: 'Recipes',
          headerRight: () => <SettingsMenu />,
        }}
      />
    </Stack>
  );
}
