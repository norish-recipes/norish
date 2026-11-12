import React, { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Brand } from "@/components/brand";
import { useLaunchEntrance } from "@/components/launch";
import { AuthField } from "@/features/auth/components/auth-field";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { HelpPopover } from "@/features/auth/components/help-popover";
import { InlineError } from "@/features/auth/components/inline-error";
import { useAuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { updateServerHref } from "@/features/auth/utils/update-server-route";
import { getServerAddress, saveServerAddress } from "@/lib/network/server-address";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-address");

export function ConnectScreen() {
  const router = useRouter();
  const intl = useIntl();
  const { change } = useLocalSearchParams<{ change?: string }>();
  const [mutedColor] = useThemeColor(["muted"] as const);
  // The boot gate's read, so a Server address opened on request shows the saved one.
  const [address, setAddress] = useState(getServerAddress);
  const connect = useAuthAttempt();
  const isConnecting = connect.running !== null;
  const entrance = useLaunchEntrance();

  const handleConnect = () =>
    void connect.run("connect", async () => {
      const check = await checkServerAddress(address);

      if (check.outcome === "error") return check.messageId;

      if (check.outcome === "too-old") {
        router.push(updateServerHref(check.address, check.version));

        return null;
      }

      return saveServerAddress(check.address).then(
        () => {
          // A change returns to the Sign in it was pushed over instead of stacking another.
          if (change !== undefined && router.canDismiss()) router.dismissAll();
          else router.replace("/login");

          return null;
        },
        (saveError: unknown) => {
          log.error({ error: saveError }, "Could not save the Server Address");

          return "common.errors.operationFailed";
        }
      );
    });

  return (
    <AuthLayout
      footer={
        <Animated.View style={entrance.buttonStyle}>
          <AuthSubmitButton
            icon={(color) => (
              <MaterialCommunityIcons color={color} name="power-plug-outline" size={20} />
            )}
            isBusy={isConnecting}
            isDisabled={isConnecting}
            label={intl.formatMessage({
              id: isConnecting ? "auth.connect.connecting" : "auth.connect.connect",
            })}
            testID="connect-submit"
            onPress={handleConnect}
          />
        </Animated.View>
      }
    >
      <Animated.View style={entrance.brandStyle}>
        <View onLayout={entrance.onBrandLayout}>
          <Brand />
        </View>
      </Animated.View>

      <Animated.View className="mt-[52px] gap-2" style={entrance.fieldStyle}>
        <AuthField
          autoCapitalize="none"
          autoCorrect={false}
          error={connect.failure}
          icon={<Feather color={mutedColor} name="server" size={20} />}
          keyboardType="url"
          label={intl.formatMessage({ id: "auth.connect.serverAddressLabel" })}
          labelAccessory={
            <HelpPopover
              label={intl.formatMessage({ id: "auth.connect.serverAddressHelp" })}
              text={intl.formatMessage({ id: "auth.connect.example" })}
            />
          }
          placeholder={intl.formatMessage({ id: "auth.connect.serverAddressPlaceholder" })}
          returnKeyType="go"
          testID="connect-server-url"
          textContentType="URL"
          value={address}
          onChangeText={connect.edit(setAddress)}
          onSubmitEditing={handleConnect}
        />
        <InlineError error={connect.failure} />
      </Animated.View>
    </AuthLayout>
  );
}
