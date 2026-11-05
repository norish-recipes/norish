import React, { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { useBackendUrl } from "@/features/auth/hooks/use-backend-url";
import { styles } from "@/features/auth/styles/connect.styles";
import {
  getBackendHealthUrl,
  normalizeBackendBaseUrl,
  saveBackendBaseUrl,
} from "@/lib/network/backend-base-url";
import { useRouter } from "expo-router";
import { Button, Input, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

const HEALTH_CHECK_TIMEOUT_MS = 7000;

export function ConnectScreen() {
  const router = useRouter();
  const intl = useIntl();
  const [foregroundColor, mutedColor, separatorColor, dangerColor, dangerSoftColor] = useThemeColor(
    ["foreground", "muted", "separator", "danger", "danger-soft"] as const
  );
  const { baseUrl, setBaseUrl, isHydrated } = useBackendUrl();
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    const normalizedBaseUrl = normalizeBackendBaseUrl(baseUrl);

    if (!normalizedBaseUrl) {
      setErrorMessage(intl.formatMessage({ id: "auth.connect.errors.invalidUrl" }));

      return;
    }

    setIsConnecting(true);
    setErrorMessage(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(getBackendHealthUrl(normalizedBaseUrl), {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      await saveBackendBaseUrl(normalizedBaseUrl);
      router.replace("/login");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setErrorMessage(intl.formatMessage({ id: "auth.connect.errors.timeout" }));
      } else if (error instanceof Error) {
        setErrorMessage(
          intl.formatMessage(
            { id: "auth.connect.errors.unreachableWithReason" },
            { reason: error.message }
          )
        );
      } else {
        setErrorMessage(intl.formatMessage({ id: "auth.connect.errors.unreachable" }));
      }
    }

    clearTimeout(timeout);
    setIsConnecting(false);
  }, [baseUrl, intl, router]);

  if (!isHydrated) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AuthShell headingPrefix={intl.formatMessage({ id: "auth.connect.title" })}>
      <Text style={[styles.label, { color: foregroundColor }]}>
        {intl.formatMessage({ id: "auth.connect.backendUrlLabel" })}
      </Text>

      <Input
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={intl.formatMessage({ id: "auth.connect.backendUrlPlaceholder" })}
        returnKeyType="done"
        value={baseUrl}
        onChangeText={setBaseUrl}
        onSubmitEditing={() => {
          void handleConnect();
        }}
      />

      <Button
        isDisabled={isConnecting}
        style={styles.connectButton}
        onPress={() => {
          void handleConnect();
        }}
      >
        <Button.Label>
          {isConnecting
            ? intl.formatMessage({ id: "auth.connect.connecting" })
            : intl.formatMessage({ id: "auth.connect.connect" })}
        </Button.Label>
      </Button>

      <Text
        style={[
          styles.helpText,
          {
            color: errorMessage ? dangerColor : mutedColor,
            borderColor: errorMessage ? dangerSoftColor : separatorColor,
          },
        ]}
      >
        {errorMessage ?? intl.formatMessage({ id: "auth.connect.example" })}
      </Text>
    </AuthShell>
  );
}
