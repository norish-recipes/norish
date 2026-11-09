import React, { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { useBackendUrl } from "@/features/auth/hooks/use-backend-url";
import { styles } from "@/features/auth/styles/connect.styles";
import { classifyServerHealth } from "@/features/auth/utils/server-version";
import {
  getBackendHealthUrl,
  normalizeBackendBaseUrl,
  saveBackendBaseUrl,
} from "@/lib/network/backend-base-url";
import { useRouter } from "expo-router";
import { Button, Input, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { REACHABILITY_DEADLINE_MS } from "@norish/shared-react/offline/reachability";

/** Asks the server at `baseUrl` what it is, and saves the address once it's a Norish new enough. */
async function reachServer(baseUrl: string, signal: AbortSignal) {
  // The deprecated route, since servers before 0.26 have no /health/ready to answer.
  const response = await fetch(getBackendHealthUrl(baseUrl), {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }

  const verdict = classifyServerHealth(await response.json().catch(() => null));

  if (verdict === "ok") await saveBackendBaseUrl(baseUrl);

  return verdict;
}

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
    }, REACHABILITY_DEADLINE_MS);

    // A separate catch, so a throw while navigating lands there too and the spinner still stops.
    await reachServer(normalizedBaseUrl, controller.signal)
      .then((verdict) => {
        if (verdict === "not-norish") {
          setErrorMessage(intl.formatMessage({ id: "auth.connect.errors.unreachable" }));
        } else if (verdict === "too-old") {
          router.push("/update-server");
        } else {
          router.replace("/login");
        }
      })
      .catch((error: unknown) => {
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
      });

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
      <Text className="font-semibold" style={[styles.label, { color: foregroundColor }]}>
        {intl.formatMessage({ id: "auth.connect.backendUrlLabel" })}
      </Text>

      <Input
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={intl.formatMessage({ id: "auth.connect.backendUrlPlaceholder" })}
        returnKeyType="done"
        testID="connect-server-url"
        value={baseUrl}
        onChangeText={setBaseUrl}
        onSubmitEditing={() => {
          void handleConnect();
        }}
      />

      <Button
        isDisabled={isConnecting}
        style={styles.connectButton}
        testID="connect-submit"
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
        className="font-normal"
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
