import React from "react";
import { View } from "react-native";
import { hostOf } from "@/features/auth/utils/host-of";
import { Button, Host, HStack, Image, Text } from "@expo/ui/swift-ui";
import {
  accessibilityIdentifier,
  accessibilityLabel,
  buttonStyle,
  font,
  foregroundStyle,
  lineLimit,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** The glass chip at a signed-out screen's foot: the server's host, opening Server address. */
export function ServerChip({ address }: { address: string }) {
  const router = useRouter();
  const intl = useIntl();
  const [foregroundColor, mutedColor, accentColor] = useThemeColor([
    "foreground",
    "muted",
    "accent",
  ] as const);
  const host = hostOf(address);

  return (
    <View className="items-center">
      <Host matchContents>
        <Button
          modifiers={[
            buttonStyle("glass"),
            accessibilityLabel(intl.formatMessage({ id: "auth.login.changeServer" }, { host })),
            accessibilityIdentifier("server-chip"),
          ]}
          onPress={() => router.push({ pathname: "/(auth)", params: { change: "server" } })}
        >
          <HStack spacing={8}>
            <Image color={accentColor} size={15} systemName="server.rack" />
            <Text
              modifiers={[
                // SwiftUI resolves the PostScript name; expo-font's `Inter_500Medium` alias is UIKit-only.
                font({ family: "Inter-Medium", size: 15 }),
                foregroundStyle(foregroundColor),
                lineLimit(1),
              ]}
            >
              {host}
            </Text>
            <Image color={mutedColor} size={12} systemName="chevron.down" />
          </HStack>
        </Button>
      </Host>
    </View>
  );
}
