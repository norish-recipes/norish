import React, { use } from "react";
import { Linking, View } from "react-native";
import { changeServerAddress } from "@/hooks/use-change-server-address";
import { useConfirmedSignOut } from "@/hooks/use-confirmed-sign-out";
import { APP_VERSION } from "@/lib/app-version";
import { useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";
import { hostOf } from "@/lib/network/host-of";
import { ServerAddressContext } from "@/lib/network/server-address";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useServerVersionQuery } from "@norish/shared-react/config";
import { useAllergiesQuery, useHousehold, useReader } from "@norish/shared-react/reader";

import { ProfileCard } from "../components/profile-card";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { versionLine } from "../utils/version-line";

type SettingsPath =
  "profile" | "preferences" | "allergies" | "household" | "tokens" | "api-keys" | "share-links";

const SUPPORT_URL = "https://github.com/norish-recipes/norish/issues";

/** Settings, pushed from the avatar menu: the account's rows, Connections, the App and Sign out. */
export function SettingsScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { user } = useReader();
  const allergies = useAllergiesQuery();
  const { household } = useHousehold();
  const serverVersion = useServerVersionQuery();
  const serverAddress = use(ServerAddressContext);
  const { locale, options } = useMobileLocaleSettings();
  const signOut = useConfirmedSignOut();
  const t = (id: string) => intl.formatMessage({ id });
  const open = (path: SettingsPath) => () => router.push(`/settings/${path}`);
  const version = versionLine(
    APP_VERSION,
    Constants.expoConfig?.ios?.buildNumber ?? "0",
    serverVersion
  );

  return (
    <SettingsPage testID="settings-screen" title={t("navbar.userMenu.settings.title")}>
      <View className="bg-surface mt-1 overflow-hidden rounded-[22px]">
        <ProfileCard
          email={user?.email ?? ""}
          image={user?.image ?? null}
          name={user?.name ?? ""}
          onPress={open("profile")}
        />
      </View>
      <SettingsGroup>
        <SettingsRow
          accessory="chevron"
          icon="options-outline"
          testID="settings-preferences"
          title={t("settings.user.preferences.title")}
          value={options.find((option) => option.code === locale)?.name}
          onPress={open("preferences")}
        />
        <SettingsRow
          accessory="chevron"
          icon="warning-outline"
          testID="settings-allergies"
          title={t("settings.user.allergies.title")}
          value={allergies.join(", ")}
          onPress={open("allergies")}
        />
      </SettingsGroup>
      <SettingsGroup title={t("settings.tabs.household")}>
        <SettingsRow
          accessory="chevron"
          icon="people-outline"
          testID="settings-household"
          title={t("settings.tabs.household")}
          value={household?.name ?? t("settings.mobile.noHousehold")}
          onPress={open("household")}
        />
      </SettingsGroup>
      <SettingsGroup title={t("settings.mobile.connections")}>
        <SettingsRow
          accessory="chevron"
          icon="key-outline"
          testID="settings-tokens"
          title={t("settings.user.siteAuthTokens.title")}
          onPress={open("tokens")}
        />
        <SettingsRow
          accessory="chevron"
          icon="terminal-outline"
          testID="settings-api-keys"
          title={t("settings.user.apiKeys.title")}
          onPress={open("api-keys")}
        />
        <SettingsRow
          accessory="chevron"
          icon="link-outline"
          testID="settings-share-links"
          title={t("settings.user.shareLinks.title")}
          onPress={open("share-links")}
        />
      </SettingsGroup>
      <SettingsGroup title={t("settings.mobile.app")}>
        <SettingsRow
          accessory="chevron"
          icon="server-outline"
          testID="settings-server"
          title={t("settings.mobile.server")}
          value={serverAddress ? hostOf(serverAddress) : undefined}
          onPress={changeServerAddress}
        />
        <SettingsRow
          accessory="external"
          icon="help-buoy-outline"
          testID="settings-support"
          title={t("settings.mobile.support")}
          onPress={() => void Linking.openURL(SUPPORT_URL)}
        />
        <SettingsRow
          icon="information-circle-outline"
          testID="settings-version"
          title={t("settings.mobile.version")}
          value={intl.formatMessage({ id: version.id }, version.values)}
        />
      </SettingsGroup>
      <View className="bg-surface mt-[30px] overflow-hidden rounded-[22px]">
        <SettingsRow
          centred
          danger
          icon="log-out-outline"
          testID="settings-sign-out"
          title={t("navbar.userMenu.logout")}
          onPress={() => void signOut()}
        />
      </View>
    </SettingsPage>
  );
}
