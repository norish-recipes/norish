import { Button, Input, useThemeColor } from 'heroui-native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';

import { AuthShell } from '@/components/shell/auth-shell';
import { useBackendUrl } from '@/hooks/use-backend-url';
import {
  getBackendHealthUrl,
  normalizeBackendBaseUrl,
  saveBackendBaseUrl,
} from '@/lib/network/backend-base-url';
import { styles } from '@/styles/connect.styles';

const HEALTH_CHECK_TIMEOUT_MS = 7000;

export default function ConnectScreen() {
  const router = useRouter();
  const [foregroundColor, mutedColor, separatorColor, dangerColor, dangerSoftColor] = useThemeColor([
    'foreground',
    'muted',
    'separator',
    'danger',
    'danger-soft',
  ] as const);
  const { baseUrl, setBaseUrl, isHydrated } = useBackendUrl();
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    const normalizedBaseUrl = normalizeBackendBaseUrl(baseUrl);

    if (!normalizedBaseUrl) {
      setErrorMessage('Enter a valid URL like https://your-server.com');
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
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      await saveBackendBaseUrl(normalizedBaseUrl);
      router.replace('/login');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setErrorMessage('Connection timed out. Verify URL and network access.');
      } else if (error instanceof Error) {
        setErrorMessage(`Could not connect to API or tRPC: ${error.message}`);
      } else {
        setErrorMessage('Could not connect to API or tRPC on that backend URL.');
      }
    } finally {
      clearTimeout(timeout);
      setIsConnecting(false);
    }
  }, [baseUrl, router]);

  if (!isHydrated) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AuthShell
      headingPrefix="Connect to"
    >
      <Text style={[styles.label, { color: foregroundColor }]}>Backend URL</Text>

      <Input
        value={baseUrl}
        onChangeText={setBaseUrl}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="https://your-norish-server.com"
        returnKeyType="done"
        onSubmitEditing={() => {
          void handleConnect();
        }}
      />

      <Button
        onPress={() => {
          void handleConnect();
        }}
        isDisabled={isConnecting}
        style={styles.connectButton}
      >
        <Button.Label>{isConnecting ? 'Connecting...' : 'Connect'}</Button.Label>
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
        {errorMessage ?? 'Example: https://demo.norish.app or http://localhost:3000'}
      </Text>
    </AuthShell>
  );
}
