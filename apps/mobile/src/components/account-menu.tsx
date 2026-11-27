import React from "react";
import { View } from "react-native";
import { DestructiveMenuButton } from "@/components/destructive-menu-button";
import { GlassSurface } from "@/components/glass";
import { useConfirmedSignOut } from "@/hooks/use-confirmed-sign-out";
import { useQueuedChanges } from "@/hooks/use-queued-changes";
import { useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";
import { useServerImage } from "@/lib/network/server-url";
import { useAppearancePreference } from "@/lib/preferences/appearance-preference-context";
import { Button, Divider, Host, Menu, Picker, RNHostView, Section, Text } from "@expo/ui/swift-ui";
import { accessibilityLabel, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Avatar } from "heroui-native";
import { useIntl } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { useReader } from "@norish/shared-react/reader";

const THEMES = [
  { mode: "system", label: "navbar.theme.system", icon: "circle.lefthalf.filled" },
  { mode: "light", label: "navbar.theme.light", icon: "sun.max" },
  { mode: "dark", label: "navbar.theme.dark", icon: "moon" },
] as const;

/** The status line: "Live", or "Offline · N changes waiting" while Queued changes wait. */
function useStatusLine() {
  const intl = useIntl();
  const { isOffline } = useConnectivity();
  const queued = useQueuedChanges();

  if (!isOffline) return intl.formatMessage({ id: "common.offlineStatus.connection.live" });

  const offline = intl.formatMessage({ id: "common.offlineStatus.connection.offline" });

  return queued > 0
    ? `${offline} · ${intl.formatMessage({ id: "common.offlineStatus.outbox.pending" }, { count: queued })}`
    : offline;
}

/** The avatar on a glass disc, a warning dot on it while Offline; it opens the account's menu. */
export function AccountMenu() {
  const intl = useIntl();
  const router = useRouter();
  const { user } = useReader();
  const { isOffline } = useConnectivity();
  const toImage = useServerImage();
  const status = useStatusLine();
  const signOut = useConfirmedSignOut();
  const { mode, setMode } = useAppearancePreference();
  const { locale, options, setLocale } = useMobileLocaleSettings();
  const name = user?.name ?? "";
  const label = isOffline
    ? intl.formatMessage({ id: "navbar.accountMenu.offlineLabel" }, { name })
    : name;

  return (
    <View testID="account-avatar">
      <Host matchContents>
        <Menu
          label={
            <RNHostView matchContents>
              <View className="size-11 items-center justify-center">
                <GlassSurface radius={22} />
                <Avatar alt={name} className="size-9">
                  {user?.image ? (
                    <Avatar.Image asChild source={toImage(user.image)}>
                      <Image
                        cachePolicy="memory-disk"
                        contentFit="cover"
                        style={{ width: "100%", height: "100%" }}
                      />
                    </Avatar.Image>
                  ) : null}
                  <Avatar.Fallback
                    classNames={{
                      container: "bg-avatar",
                      text: "text-foreground text-base font-semibold",
                    }}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar>
                {isOffline ? (
                  <View
                    className="bg-warning border-background absolute top-0.5 right-0.5 size-3 rounded-full border-2"
                    testID="account-offline-dot"
                  />
                ) : null}
              </View>
            </RNHostView>
          }
          modifiers={[accessibilityLabel(label)]}
        >
          {/* A section title, the one menu row VoiceOver reads as text; menus draw no colour there. */}
          <Section title={status}>
            <Menu
              label={options.find((option) => option.code === locale)?.name ?? ""}
              systemImage="globe"
            >
              <Picker
                modifiers={[pickerStyle("inline")]}
                selection={locale}
                onSelectionChange={setLocale}
              >
                {options.map((option) => (
                  <Text key={option.code} modifiers={[tag(option.code)]}>
                    {option.name}
                  </Text>
                ))}
              </Picker>
            </Menu>
            <Menu
              label={intl.formatMessage({ id: "navbar.theme.title" })}
              systemImage={THEMES.find((theme) => theme.mode === mode)?.icon}
            >
              <Picker
                modifiers={[pickerStyle("inline")]}
                selection={mode}
                onSelectionChange={setMode}
              >
                {THEMES.map((theme) => (
                  <Text key={theme.mode} modifiers={[tag(theme.mode)]}>
                    {intl.formatMessage({ id: theme.label })}
                  </Text>
                ))}
              </Picker>
            </Menu>
            <Button
              label={intl.formatMessage({ id: "navbar.accountMenu.allSettings" })}
              systemImage="gearshape"
              onPress={() => router.navigate("/settings")}
            />
          </Section>
          <Divider />
          <DestructiveMenuButton
            label={intl.formatMessage({ id: "navbar.userMenu.logout" })}
            systemImage="rectangle.portrait.and.arrow.right"
            onPress={() => void signOut()}
          />
        </Menu>
      </Host>
    </View>
  );
}
