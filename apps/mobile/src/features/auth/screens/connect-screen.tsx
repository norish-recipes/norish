import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { ServerAddressErrorId } from "@/features/auth/utils/check-server-address";
import React, { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Brand } from "@/components/brand";
import { useLaunchEntrance } from "@/components/launch";
import { AuthField } from "@/features/auth/components/auth-field";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { HelpPopover } from "@/features/auth/components/help-popover";
import { InlineErrorBlock } from "@/features/auth/components/inline-error";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { getServerAddress, saveServerAddress } from "@/lib/network/server-address";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, InputGroup, Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-address");

export function ConnectScreen() {
  const router = useRouter();
  const intl = useIntl();
  const { change } = useLocalSearchParams<{ change?: string }>();
  const [mutedColor, accentForegroundColor] = useThemeColor([
    "muted",
    "accent-foreground",
  ] as const);
  // The boot gate's read, so a Server address opened on request shows the saved one.
  const [address, setAddress] = useState(getServerAddress);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<InlineErrorState>(null);
  const entrance = useLaunchEntrance();

  const fail = (id: ServerAddressErrorId | "common.errors.operationFailed") =>
    setError({ message: intl.formatMessage({ id }) });

  const handleConnect = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    setError(null);

    const check = await checkServerAddress(address);

    if (check.outcome === "error") {
      fail(check.messageId);
    } else if (check.outcome === "too-old") {
      router.push("/update-server");
    } else {
      await saveServerAddress(check.address).then(
        // A change returns to the Sign in it was pushed over instead of stacking another.
        () =>
          change !== undefined && router.canDismiss()
            ? router.dismissAll()
            : router.replace("/login"),
        (saveError: unknown) => {
          log.error({ error: saveError }, "Could not save the Server Address");
          fail("common.errors.operationFailed");
        }
      );
    }

    setIsConnecting(false);
  };

  return (
    <AuthLayout
      footer={
        <Animated.View style={entrance.buttonStyle}>
          <Button
            className="rounded-full"
            isDisabled={isConnecting}
            size="lg"
            testID="connect-submit"
            onPress={() => void handleConnect()}
          >
            {isConnecting ? (
              <Spinner color={accentForegroundColor} size="sm" />
            ) : (
              <MaterialCommunityIcons
                color={accentForegroundColor}
                name="power-plug-outline"
                size={20}
              />
            )}
            <Button.Label>
              {intl.formatMessage({
                id: isConnecting ? "auth.connect.connecting" : "auth.connect.connect",
              })}
            </Button.Label>
          </Button>
        </Animated.View>
      }
    >
      <Animated.View style={entrance.brandStyle}>
        <View onLayout={entrance.onBrandLayout}>
          <Brand />
        </View>
      </Animated.View>

      <Animated.View className="mt-[52px] gap-1.5" style={entrance.fieldStyle}>
        <InlineErrorBlock error={error}>
          <AuthField
            isInvalid={error !== null}
            label={intl.formatMessage({ id: "auth.connect.serverAddressLabel" })}
            labelAccessory={
              <HelpPopover
                label={intl.formatMessage({ id: "auth.connect.serverAddressHelp" })}
                text={intl.formatMessage({ id: "auth.connect.example" })}
              />
            }
          >
            <InputGroup.Prefix isDecorative>
              <Feather color={mutedColor} name="server" size={20} />
            </InputGroup.Prefix>
            <InputGroup.Input
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={intl.formatMessage({ id: "auth.connect.serverAddressPlaceholder" })}
              returnKeyType="go"
              testID="connect-server-url"
              textContentType="URL"
              value={address}
              onChangeText={setAddress}
              onSubmitEditing={() => void handleConnect()}
            />
          </AuthField>
        </InlineErrorBlock>
      </Animated.View>
    </AuthLayout>
  );
}
