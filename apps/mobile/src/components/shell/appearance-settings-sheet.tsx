import {
  BottomSheet,
  Button,
  Description,
  Label,
  Radio,
  RadioGroup,
  useThemeColor,
} from 'heroui-native';
import React from 'react';
import { View } from 'react-native';

import {
  type AppearanceMode,
  useAppearancePreference,
} from '@/context/appearance-preference-context';

function AppearanceSection() {
  const { mode, setMode } = useAppearancePreference();
  const [titleColor, mutedColor] = useThemeColor(['foreground', 'muted']);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 3 }}>
        <BottomSheet.Title style={{ color: titleColor }}>App settings</BottomSheet.Title>
        <BottomSheet.Description style={{ color: mutedColor }}>Appearance</BottomSheet.Description>
      </View>

      <RadioGroup value={mode} onValueChange={(value) => setMode(value as AppearanceMode)}>
        <RadioGroup.Item value="system">
          <View>
            <Label>System</Label>
            <Description>Follow your device appearance.</Description>
          </View>
          <Radio />
        </RadioGroup.Item>

        <RadioGroup.Item value="light">
          <View>
            <Label>Light</Label>
            <Description>Always use light mode.</Description>
          </View>
          <Radio />
        </RadioGroup.Item>

        <RadioGroup.Item value="dark">
          <View>
            <Label>Dark</Label>
            <Description>Always use dark mode.</Description>
          </View>
          <Radio />
        </RadioGroup.Item>
      </RadioGroup>
    </View>
  );
}

export function AppearanceSettingsSheet({
  isOpen,
  onOpenChange,
  onClose,
}: {
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <AppearanceSection />
          <View style={{ marginTop: 16 }}>
            <Button variant="secondary" onPress={onClose}>
              <Button.Label>Done</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
