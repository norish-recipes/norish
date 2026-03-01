import { Button, Card, useThemeColor } from 'heroui-native';
import React from 'react';

export function ProviderErrorState({ onRetry }: { onRetry: () => void }) {
  const [dangerColor, mutedColor] = useThemeColor([
    'danger',
    'muted',
  ] as const);

  return (
    <>
      <Card.Title style={{ color: dangerColor }}>Could not load providers</Card.Title>
      <Card.Description style={{ color: mutedColor }}>
        Check backend URL and auth server availability, then retry.
      </Card.Description>
      <Button
        onPress={() => {
          onRetry();
        }}
      >
        <Button.Label>Retry</Button.Label>
      </Button>
    </>
  );
}
