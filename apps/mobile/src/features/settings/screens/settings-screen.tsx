import React, { use } from "react";
import { Linking, Text } from "react-native";
import { changeServerAddress } from "@/hooks/use-change-server-address";
import { useConfirmedSignOut } from "@/hooks/use-confirmed-sign-out";
import { useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";
import { useText } from "@/lib/i18n/use-text";
import { hostOf } from "@/lib/network/host-of";
import { ServerAddressContext } from "@/lib/network/server-address";
import * as Application from "expo-application";
import { useRouter } from "expo-router";

import { useServerVersionQuery } from "@norish/shared-react/config";
import { useAllergiesQuery, useHousehold, useReader } from "@norish/shared-react/reader";

import { ProfileCard } from "../components/profile-card";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { readState } from "../utils/read-state";
import { versionLine } from "../utils/version-line";

type SettingsPath =
  "profile" | "preferences" | "allergies" | "household" | "tokens" | "api-keys" | "share-links";

const SUPPORT_URL = "https://github.com/norish-recipes/norish/issues";

/** Settings, pushed from the avatar menu: the account's rows, Connections, the App and Sign out. */
export function SettingsScreen() {
  const router = useRouter();
  const { user } = useReader();
  const { allergies } = useAllergiesQuery();
  const { household, currentUserId, isLoading, error } = useHousehold();
  // As the Household page reads it: "No household" only once a read said so.
  const householdRead = readState({
    held: household !== null,
    answered: currentUserId !== undefined,
    isLoading,
    error,
  });
  const serverVersion = useServerVersionQuery();
  const serverAddress = use(ServerAddressContext);
  const { locale, options } = useMobileLocaleSettings();
  const signOut = useConfirmedSignOut();
  const text = useText();
  const open = (path: SettingsPath) => () => router.push(`/settings/${path}`);
  const version = versionLine(
    Application.nativeApplicationVersion,
    Application.nativeBuildVersion,
    serverVersion ? text("settings.mobile.versionServer", { server: serverVersion }) : null
  );

  return (
    <SettingsPage testID="settings-root-screen" title={text("navbar.userMenu.settings.title")}>
      <SettingsGroup className="pt-1">
        <ProfileCard
          email={user?.email ?? ""}
          image={user?.image ?? null}
          name={user?.name ?? ""}
          onPress={open("profile")}
        />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow
          accessory="chevron"
          icon="options-outline"
          testID="settings-root-preferences"
          title={text("settings.user.preferences.title")}
          value={options.find((option) => option.code === locale)?.name}
          onPress={open("preferences")}
        />
        <SettingsRow
          accessory="chevron"
          icon="warning-outline"
          testID="settings-root-allergies"
          title={text("settings.user.allergies.title")}
          value={allergies.join(", ")}
          onPress={open("allergies")}
        />
      </SettingsGroup>
      <SettingsGroup title={text("settings.tabs.household")}>
        <SettingsRow
          accessory="chevron"
          icon="people-outline"
          testID="settings-root-household"
          title={text("settings.tabs.household")}
          value={
            household?.name ??
            (householdRead === "empty" ? text("settings.mobile.noHousehold") : undefined)
          }
          onPress={open("household")}
        />
      </SettingsGroup>
      <SettingsGroup title={text("settings.mobile.connections")}>
        <SettingsRow
          accessory="chevron"
          icon="key-outline"
          testID="settings-root-tokens"
          title={text("settings.user.siteAuthTokens.title")}
          onPress={open("tokens")}
        />
        <SettingsRow
          accessory="chevron"
          icon="terminal-outline"
          testID="settings-root-api-keys"
          title={text("settings.user.apiKeys.title")}
          onPress={open("api-keys")}
        />
        <SettingsRow
          accessory="chevron"
          icon="link-outline"
          testID="settings-root-share-links"
          title={text("settings.user.shareLinks.title")}
          onPress={open("share-links")}
        />
      </SettingsGroup>
      <SettingsGroup title={text("settings.mobile.app")}>
        <SettingsRow
          accessory="chevron"
          icon="server-outline"
          testID="settings-root-server"
          title={text("settings.mobile.server")}
          value={serverAddress ? hostOf(serverAddress) : undefined}
          onPress={changeServerAddress}
        />
        <SettingsRow
          accessory="external"
          icon="help-buoy-outline"
          testID="settings-root-support"
          title={text("settings.mobile.support")}
          onPress={() => void Linking.openURL(SUPPORT_URL)}
        />
      </SettingsGroup>
      <SettingsGroup className="pt-[30px]">
        <SettingsRow
          centred
          danger
          icon="log-out-outline"
          testID="settings-root-sign-out"
          title={text("navbar.userMenu.logout")}
          onPress={() => void signOut()}
        />
      </SettingsGroup>
      <Text className="text-muted pt-4 text-center text-[13px]" testID="settings-root-version">
        {version}
      </Text>
    </SettingsPage>
  );
}
