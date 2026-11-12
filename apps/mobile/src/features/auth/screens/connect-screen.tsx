import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { ServerAddressErrorId } from "@/features/auth/utils/check-server-address";
import React, { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Brand } from "@/components/brand";
import { useLaunchEntrance } from "@/components/launch";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { HelpPopover } from "@/features/auth/components/help-popover";
import { InlineError, useErrorShake } from "@/features/auth/components/inline-error";
import { useServerAddressDraft } from "@/features/auth/hooks/use-server-address-draft";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { saveServerAddress } from "@/lib/network/server-address";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { Button, InputGroup, Label, Spinner, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-address");

export function ConnectScreen() {
  const router = useRouter();
  const intl = useIntl();
  const [mutedColor, accentForegroundColor] = useThemeColor([
    "muted",
    "accent-foreground",
  ] as const);
  const { address, setAddress, isHydrated } = useServerAddressDraft();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<InlineErrorState>(null);
  const shakeStyle = useErrorShake(error);
  const entrance = useLaunchEntrance();

  const fail = (id: ServerAddressErrorId | "common.errors.operationFailed") =>
    setError({ message: intl.formatMessage({ id }) });

  const handleConnect = async () => {
    if (isConnecting || !isHydrated) return;

    setIsConnecting(true);
    setError(null);

    const check = await checkServerAddress(address);

    if (check.outcome === "error") {
      fail(check.messageId);
    } else if (check.outcome === "too-old") {
      router.push("/update-server");
    } else {
      await saveServerAddress(check.address).then(
        () => router.replace("/login"),
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

      <Animated.View style={entrance.fieldStyle}>
        <TextField className="mt-[52px]" isInvalid={error !== null}>
          <View className="flex-row items-center gap-1 pl-1">
            <Label isInvalid={false}>
              {intl.formatMessage({ id: "auth.connect.serverAddressLabel" })}
            </Label>
            <HelpPopover
              label={intl.formatMessage({ id: "auth.connect.serverAddressHelp" })}
              text={intl.formatMessage({ id: "auth.connect.example" })}
            />
          </View>
          <Animated.View style={shakeStyle}>
            <InputGroup>
              <InputGroup.Prefix isDecorative>
                <Feather color={mutedColor} name="server" size={20} />
              </InputGroup.Prefix>
              <InputGroup.Input
                autoCapitalize="none"
                autoCorrect={false}
                // Drawn before the draft is read so the splash can measure the brand; typing waits for it.
                editable={isHydrated}
                keyboardType="url"
                placeholder={intl.formatMessage({ id: "auth.connect.serverAddressPlaceholder" })}
                returnKeyType="go"
                testID="connect-server-url"
                textContentType="URL"
                value={address}
                onChangeText={setAddress}
                onSubmitEditing={() => void handleConnect()}
              />
            </InputGroup>
          </Animated.View>
          <InlineError error={error} />
        </TextField>
      </Animated.View>
    </AuthLayout>
  );
}
