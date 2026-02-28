import { Button, Card, Input, useThemeColor } from 'heroui-native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getBackendHealthUrl,
  loadBackendBaseUrl,
  normalizeBackendBaseUrl,
  saveBackendBaseUrl,
} from '@/lib/network/backend-base-url';

const HEALTH_CHECK_TIMEOUT_MS = 7000;

export default function ConnectScreen() {
  const router = useRouter();
  const [foregroundColor, mutedColor, accentColor, separatorColor, dangerColor, dangerSoftColor] = useThemeColor([
    'foreground',
    'muted',
    'accent',
    'separator',
    'danger',
    'danger-soft',
  ] as const);
  const [baseUrl, setBaseUrl] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const existingBaseUrl = await loadBackendBaseUrl();

      if (!isMounted) {
        return;
      }

      if (existingBaseUrl) {
        router.replace('/recipes');
        return;
      }

      setIsHydrated(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [router]);

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
      router.replace('/recipes');
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="always"
      >
        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: accentColor }]}>Mobile API Setup</Text>
          <Text style={[styles.title, { color: foregroundColor }]}>Connect your Norish backend</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>Enter your backend base URL. We verify `/api/health` before saving and then connect app tRPC using that base URL.</Text>
        </View>

        <Card variant="secondary" className="rounded-3xl border border-separator">
          <Card.Body style={styles.cardBody}>
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
              {errorMessage ?? 'Example: https://demo.norish.app or http://192.168.1.10:3000'}
            </Text>
          </Card.Body>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 20,
  },
  heroCopy: {
    gap: 8,
    paddingHorizontal: 4,
  },
  eyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  cardBody: {
    gap: 14,
    padding: 16,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  connectButton: {
    marginTop: 6,
  },
  helpText: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
  },
});
