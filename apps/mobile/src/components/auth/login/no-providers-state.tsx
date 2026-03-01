import { Card, useThemeColor } from 'heroui-native';
import React from 'react';

export function NoProvidersState() {
  const [foregroundColor, mutedColor] = useThemeColor([
    'foreground',
    'muted',
  ] as const);

  return (
    <>
      <Card.Title style={{ color: foregroundColor }}>No sign-in methods available</Card.Title>
      <Card.Description style={{ color: mutedColor }}>
        Authentication providers are not configured on the backend.
      </Card.Description>
    </>
  );
}
