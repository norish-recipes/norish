import { Button, Card, Input, useThemeColor } from 'heroui-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { AuthProvidersResponse } from '@norish/shared/contracts';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { useTRPC } from '@/providers/trpc-provider';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export default function RegisterScreen() {
  const router = useRouter();
  const { backendBaseUrl, authClient } = useAuth();

  const [foregroundColor, mutedColor, accentColor, dangerColor] = useThemeColor([
    'foreground',
    'muted',
    'accent',
    'danger',
  ] as const);

  if (backendBaseUrl === null) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="always"
      >
        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: accentColor }]}>Norish</Text>
          <Text style={[styles.title, { color: foregroundColor }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>
            Backend URL is not configured. Connect to your backend first.
          </Text>
        </View>
        <Card variant="secondary" className="rounded-3xl border border-separator">
          <Card.Body style={[styles.cardBody, styles.centered]}>
            <Button
              onPress={() => {
                router.replace('/connect' as any);
              }}
            >
              <Button.Label>Open Connect</Button.Label>
            </Button>
          </Card.Body>
        </Card>
      </ScrollView>
    );
  }

  return (
    <RegisterForm
      backendBaseUrl={backendBaseUrl}
      authClient={authClient}
      foregroundColor={foregroundColor}
      mutedColor={mutedColor}
      accentColor={accentColor}
      dangerColor={dangerColor}
    />
  );
}

function RegisterForm({
  backendBaseUrl,
  authClient,
  foregroundColor,
  mutedColor,
  accentColor,
  dangerColor,
}: {
  backendBaseUrl: string;
  authClient: ReturnType<typeof import('@/lib/auth-client').getAuthClient> | null;
  foregroundColor: string;
  mutedColor: string;
  accentColor: string;
  dangerColor: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trpc = useTRPC();
  const providersQuery = useQuery(
    (trpc as any).config.authProviders.queryOptions(undefined, {
      staleTime: 30_000,
    }),
  );

  const authProvidersData = providersQuery.data as AuthProvidersResponse | undefined;
  const registrationEnabled = authProvidersData?.registrationEnabled ?? false;

  const handleSignUp = useCallback(async () => {
    if (!authClient) return;

    setErrorMessage(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setErrorMessage('Name is required.');
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage('Email is required.');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await authClient.signUp.email({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message ?? 'Could not create account.');
        return;
      }

      // BetterAuth autoSignIn is enabled, so the session is established
      // automatically. Stack.Protected guard handles the redirect to (tabs).
    } catch (error) {
      if (error instanceof Error && error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not create account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [authClient, confirmPassword, email, name, password]);

  // If we've loaded the providers and registration is not enabled, show a message
  if (providersQuery.data && !registrationEnabled) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="always"
      >
        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: accentColor }]}>Norish</Text>
          <Text style={[styles.title, { color: foregroundColor }]}>Registration disabled</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>
            Registration is currently disabled on this server. Contact your server administrator for
            access.
          </Text>
        </View>
        <Pressable onPress={() => router.replace('/login' as any)} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: mutedColor }]}>
            Already have an account?{' '}
            <Text style={{ color: accentColor, fontWeight: '600' }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  const passwordsMatch = password === confirmPassword;
  const isFormValid =
    name.trim() && email.trim() && password && confirmPassword && passwordsMatch;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="always"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCopy}>
        <Text style={[styles.eyebrow, { color: accentColor }]}>Norish</Text>
        <Text style={[styles.title, { color: foregroundColor }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>
          Sign up with your email and password to get started.
        </Text>
      </View>

      <Card variant="secondary" className="rounded-3xl border border-separator">
        <Card.Body style={styles.cardBody}>
          <View style={styles.formSection}>
            <Input
              value={name}
              onChangeText={(text) => {
                setName(text);
                setErrorMessage(null);
              }}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Name"
            />
            <Input
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrorMessage(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email"
            />
            <Input
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrorMessage(null);
              }}
              secureTextEntry
              placeholder="Password"
            />
            <Input
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setErrorMessage(null);
              }}
              secureTextEntry
              placeholder="Confirm password"
            />
            <Text style={[styles.hint, { color: mutedColor }]}>
              Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters.
            </Text>
            <Button
              isDisabled={!isFormValid || isSubmitting}
              onPress={() => {
                void handleSignUp();
              }}
            >
              <Button.Label>
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </Button.Label>
            </Button>
          </View>
        </Card.Body>
      </Card>

      {errorMessage && (
        <Text style={[styles.errorText, { color: dangerColor }]}>{errorMessage}</Text>
      )}

      <Pressable onPress={() => router.replace('/login' as any)} style={styles.linkRow}>
        <Text style={[styles.linkText, { color: mutedColor }]}>
          Already have an account?{' '}
          <Text style={{ color: accentColor, fontWeight: '600' }}>Sign in</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    gap: 12,
    padding: 16,
  },
  centered: {
    alignItems: 'center',
  },
  formSection: {
    gap: 10,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  linkRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
