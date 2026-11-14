import React from "react";
import { changeServerAddress } from "@/hooks/use-change-server-address";
import { hostOf } from "@/lib/network/host-of";
import { Button, Host, HStack, Image, Text } from "@expo/ui/swift-ui";
import {
  accessibilityIdentifier,
  accessibilityLabel,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  lineLimit,
} from "@expo/ui/swift-ui/modifiers";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";
import { useCSSVariable } from "uniwind";

/** The glass chip at a screen's foot: the server's host, changing the Server Address. */
export function ServerChip({ address }: { address: string }) {
  const intl = useIntl();
  const [foregroundColor, mutedColor, accentColor] = useThemeColor([
    "foreground",
    "muted",
    "accent",
  ] as const);
  // useThemeColor only names heroui-native's own tokens, so this one is read directly.
  const accentText = useCSSVariable("--color-accent-text");
  const host = hostOf(address);

  return (
    // Host's matchContents fixes the width to the content's, so lineLimit never truncates; the
    // host fills the content width instead and centres the chip, which truncates a long host.
    <Host alignment="center" matchContents={{ vertical: true }} style={{ alignSelf: "stretch" }}>
      <Button
        modifiers={[
          buttonStyle("glass"),
          accessibilityLabel(intl.formatMessage({ id: "auth.login.changeServer" }, { host })),
          accessibilityIdentifier("server-chip"),
        ]}
        onPress={changeServerAddress}
      >
        {/* The glass pads the label 7pt above and below, so a 26pt label makes a 40pt chip. */}
        <HStack modifiers={[frame({ height: 26 })]} spacing={8}>
          <Image
            color={typeof accentText === "string" ? accentText : accentColor}
            size={16}
            systemName="server.rack"
          />
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
          <Image color={mutedColor} size={16} systemName="chevron.down" />
        </HStack>
      </Button>
    </Host>
  );
}
