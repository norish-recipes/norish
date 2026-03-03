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
import { useIntl } from 'react-intl';
import { View } from 'react-native';

import {
  type AppearanceMode,
  useAppearancePreference,
} from '@/context/appearance-preference-context';
import { useMobileLocaleSettings } from '@/context/mobile-i18n-context';

function LanguageSection() {
  const intl = useIntl();
  const { enabledLocales, isLoading, locale, localeNames, setLocale } = useMobileLocaleSettings();

  if (isLoading) {
    return null;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 3 }}>
        <Label>
          {intl.formatMessage({
            id: 'settings.user.preferences.language.title',
            defaultMessage: 'Language',
          })}
        </Label>
        <Description>
          {intl.formatMessage({
            id: 'settings.user.preferences.language.description',
            defaultMessage: 'Choose your preferred language',
          })}
        </Description>
      </View>

      <RadioGroup value={locale} onValueChange={setLocale}>
        {enabledLocales.map((option) => (
          <RadioGroup.Item key={option.code} value={option.code}>
            <View>
              <Label>{localeNames[option.code] ?? option.code}</Label>
              <Description>{option.code}</Description>
            </View>
            <Radio />
          </RadioGroup.Item>
        ))}
      </RadioGroup>
    </View>
  );
}

function AppearanceSection() {
  const { mode, setMode } = useAppearancePreference();
  const intl = useIntl();
  const [titleColor, mutedColor] = useThemeColor(['foreground', 'muted']);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 3 }}>
        <BottomSheet.Title style={{ color: titleColor }}>
          {intl.formatMessage({ id: 'settings.page.title', defaultMessage: 'App settings' })}
        </BottomSheet.Title>
        <BottomSheet.Description style={{ color: mutedColor }}>
          {intl.formatMessage({ id: 'settings.user.preferences.title', defaultMessage: 'Appearance' })}
        </BottomSheet.Description>
      </View>

      <RadioGroup value={mode} onValueChange={(value) => setMode(value as AppearanceMode)}>
        <RadioGroup.Item value="system">
          <View>
            <Label>
              {intl.formatMessage({
                id: 'settings.user.preferences.appearance.system',
                defaultMessage: 'System',
              })}
            </Label>
            <Description>
              {intl.formatMessage({
                id: 'settings.user.preferences.appearance.systemDescription',
                defaultMessage: 'Follow your device appearance.',
              })}
            </Description>
          </View>
          <Radio />
        </RadioGroup.Item>

        <RadioGroup.Item value="light">
          <View>
            <Label>
              {intl.formatMessage({
                id: 'settings.user.preferences.appearance.light',
                defaultMessage: 'Light',
              })}
            </Label>
            <Description>
              {intl.formatMessage({
                id: 'settings.user.preferences.appearance.lightDescription',
                defaultMessage: 'Always use light mode.',
              })}
            </Description>
          </View>
          <Radio />
        </RadioGroup.Item>

        <RadioGroup.Item value="dark">
          <View>
            <Label>
              {intl.formatMessage({
                id: 'settings.user.preferences.appearance.dark',
                defaultMessage: 'Dark',
              })}
            </Label>
            <Description>
              {intl.formatMessage({
                id: 'settings.user.preferences.appearance.darkDescription',
                defaultMessage: 'Always use dark mode.',
              })}
            </Description>
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
  const intl = useIntl();

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal hostName="app">
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <AppearanceSection />
          <View style={{ marginTop: 12 }}>
            <LanguageSection />
          </View>
          <View style={{ marginTop: 16 }}>
            <Button variant="secondary" onPress={onClose}>
              <Button.Label>
                {intl.formatMessage({ id: 'common.actions.done', defaultMessage: 'Done' })}
              </Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
