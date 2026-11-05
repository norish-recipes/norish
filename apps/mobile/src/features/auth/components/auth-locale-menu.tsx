import React, { useSyncExternalStore } from "react";
import { ShellMenu } from "@/features/auth/components/shell-menu";
import { getLocaleSnapshot, subscribeLocaleStore } from "@/lib/i18n/locale-store";
import { useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";
import { Button as UIButton } from "@expo/ui/swift-ui";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

export function AuthLocaleMenu() {
  const intl = useIntl();
  const [mutedColor] = useThemeColor(["muted"] as const);
  const { enabledLocales, localeNames, setLocale } = useMobileLocaleSettings();
  const { locale } = useSyncExternalStore(
    subscribeLocaleStore,
    getLocaleSnapshot,
    getLocaleSnapshot
  );

  return (
    <ShellMenu
      label={intl.formatMessage({ id: "common.language.title" })}
      systemImage="gearshape"
      color={mutedColor}
    >
      {enabledLocales.map((entry) => (
        <UIButton
          key={entry.code}
          label={localeNames[entry.code] ?? entry.code}
          systemImage={locale === entry.code ? "checkmark" : undefined}
          onPress={() => setLocale(entry.code)}
        />
      ))}
    </ShellMenu>
  );
}
