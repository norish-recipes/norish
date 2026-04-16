import type { AppearanceMode } from "@/context/appearance-preference-context";
import React, { useSyncExternalStore } from "react";
import { ShellMenu } from "@/components/shell/menu";
import { useAppearancePreference } from "@/context/appearance-preference-context";
import { useMobileLocaleSettings } from "@/context/mobile-i18n-context";
import { getLocaleSnapshot, subscribeLocaleStore } from "@/lib/i18n/locale-store";
import { Picker, Button as UIButton, Text as UIText } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/**
 * Native iOS settings menu for the Recipes tab header.
 */
export function SettingsMenu() {
  const router = useRouter();
  const intl = useIntl();
  const [mutedColor] = useThemeColor(["muted"] as const);
  const { mode, setMode } = useAppearancePreference();
  const { enabledLocales, localeNames, isLoading, setLocale } = useMobileLocaleSettings();

  // Read locale from the synchronous store so this component re-renders on
  // the same tick that setLocale() is called, not after the async React state
  // chain settles.
  const { locale } = useSyncExternalStore(
    subscribeLocaleStore,
    getLocaleSnapshot,
    getLocaleSnapshot
  );

  return (
    <ShellMenu
      label={intl.formatMessage({ id: "navbar.userMenu.settings.title" })}
      systemImage="gearshape"
      color={mutedColor}
    >
      {/* Each Picker with pickerStyle('menu') renders as its own sub-menu row
          with a chevron, opening a secondary flyout of options. */}
      <Picker
        key={mode}
        label={intl.formatMessage({ id: "navbar.theme.title" })}
        systemImage="circle.lefthalf.filled"
        selection={mode}
        onSelectionChange={(value) => setMode(value as AppearanceMode)}
        modifiers={[pickerStyle("menu")]}
      >
        <UIText modifiers={[tag("system")]}>
          {intl.formatMessage({ id: "navbar.theme.system" })}
        </UIText>
        <UIText modifiers={[tag("light")]}>
          {intl.formatMessage({ id: "navbar.theme.light" })}
        </UIText>
        <UIText modifiers={[tag("dark")]}>{intl.formatMessage({ id: "navbar.theme.dark" })}</UIText>
      </Picker>

      {!isLoading && enabledLocales.length > 1 && (
        <Picker
          key={locale}
          label={localeNames[locale] ?? locale}
          systemImage="globe"
          selection={locale}
          onSelectionChange={(value) => setLocale(value as string)}
          modifiers={[pickerStyle("menu")]}
        >
          {enabledLocales.map((l) => (
            <UIText key={l.code} modifiers={[tag(l.code)]}>
              {localeNames[l.code] ?? l.code}
            </UIText>
          ))}
        </Picker>
      )}

      <UIButton
        label={intl.formatMessage({ id: "settings.user.profile.title" })}
        systemImage="person.crop.circle"
        onPress={() => router.push("/(tabs)/profile")}
      />
    </ShellMenu>
  );
}
