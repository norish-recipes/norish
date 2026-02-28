import '@/global.css';

import { Slot } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  AppearancePreferenceProvider,
  useAppearancePreference,
} from '@/context/appearance-preference-context';

function RootLayoutContent() {
  const { hydrated } = useAppearancePreference();

  if (!hydrated) {
    return null;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <HeroUINativeProvider>
        <AppearancePreferenceProvider>
          <RootLayoutContent />
        </AppearancePreferenceProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
