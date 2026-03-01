import { Button, Card, useThemeColor } from 'heroui-native';
import React from 'react';

export function BackendMissingState({ onOpenConnect }: { onOpenConnect: () => void }) {
  const [dangerColor, mutedColor] = useThemeColor([
    'danger',
    'muted',
  ] as const);

  return (
    <>
      <Card.Title style={{ color: dangerColor }}>Backend configuration required</Card.Title>
      <Card.Description style={{ color: mutedColor }}>
        Backend URL is not configured. Open Connect to set your Norish backend URL.
      </Card.Description>
      <Button
        onPress={() => {
          onOpenConnect();
        }}
      >
        <Button.Label>Open Connect</Button.Label>
      </Button>
    </>
  );
}
