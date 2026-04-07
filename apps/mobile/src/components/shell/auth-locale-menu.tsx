import React, { useSyncExternalStore } from "react";
import { useMobileLocaleSettings } from "@/context/mobile-i18n-context";
import { getLocaleSnapshot, subscribeLocaleStore } from "@/lib/i18n/locale-store";
import { Button as UIButton } from "@expo/ui/swift-ui";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { ShellMenu } from "./menu";

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
