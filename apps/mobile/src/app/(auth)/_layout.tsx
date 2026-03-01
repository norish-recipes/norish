import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Use 'none' so the shared auth shell (logo + card border) appears to
        // stay in place when navigating between connect/login/register. The
        // visual transition is handled by Reanimated layout animations inside
        // each pane's content, not by the navigator.
        animation: 'default',
      }}
    />
  );
}
