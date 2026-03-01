import { Button, Card, Input, useThemeColor } from 'heroui-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { AuthProvidersResponse, ProviderInfo } from '@norish/shared/contracts';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { useTRPC } from '@/providers/trpc-provider';

const DEFAULT_PROTECTED_ROUTE = '/recipes';

function sanitizeRedirectTarget(target: string | null | undefined): string {
  if (!target) return DEFAULT_PROTECTED_ROUTE;
  let candidate = target;

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // keep raw
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//')) return DEFAULT_PROTECTED_ROUTE;
  if (candidate === '/login' || candidate.startsWith('/auth/')) return DEFAULT_PROTECTED_ROUTE;

  return candidate;
}

function firstParam(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

function toProviderType(provider: ProviderInfo): 'oauth' | 'credential' {
  if (provider.type === 'credential' || provider.id === 'credential') return 'credential';

  return 'oauth';
}

// Rendered only when backendBaseUrl is set and TrpcProvider is in the tree.
// Calls useTRPC() safely — no provider context crash.
function LoginForm({
  backendBaseUrl,
  redirectTo,
  justLoggedOut,
  justLoggedOutFromQuery,
}: {
  backendBaseUrl: string;
  redirectTo: string;
  justLoggedOut: boolean;
  justLoggedOutFromQuery: boolean;
}) {
  const router = useRouter();
  const { authClient, consumeLogoutFlag } = useAuth();
  const [foregroundColor, mutedColor, dangerColor, accentColor] = useThemeColor([
    'foreground',
    'muted',
    'danger',
    'accent',
  ] as const);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmittingCredentials, setIsSubmittingCredentials] = useState(false);
  const [activeOAuthProviderId, setActiveOAuthProviderId] = useState<string | null>(null);
  const [autoRedirectStarted, setAutoRedirectStarted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trpc = useTRPC();
  const providersQuery = useQuery(
    (trpc as any).config.authProviders.queryOptions(undefined, {
      staleTime: 30_000,
    }),
  );

  const authProvidersData = providersQuery.data as AuthProvidersResponse | undefined;
  const providers = authProvidersData?.providers ?? [];
  const registrationEnabled = authProvidersData?.registrationEnabled ?? false;
  const passwordAuthEnabled = authProvidersData?.passwordAuthEnabled ?? false;
  const credentialProvider = providers.find((p) => toProviderType(p) === 'credential');
  const oauthProviders = providers.filter((p) => toProviderType(p) === 'oauth');

  const shouldAutoRedirect =
    oauthProviders.length === 1 &&
    !credentialProvider &&
    !justLoggedOut &&
    !justLoggedOutFromQuery;

  const handleOAuthSignIn = useCallback(
    async (provider: ProviderInfo) => {
      if (!authClient || !backendBaseUrl) return;

      setErrorMessage(null);
      setActiveOAuthProviderId(provider.id);

      try {
        await authClient.signIn.social({
          provider: provider.id as any,
          callbackURL: redirectTo,
        });
        consumeLogoutFlag();
      } catch (error) {
        if (error instanceof Error && error.message) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not start OAuth sign-in. Please try again.');
        }
      } finally {
        setActiveOAuthProviderId(null);
      }
    },
    [authClient, backendBaseUrl, consumeLogoutFlag, redirectTo],
  );

  useEffect(() => {
    if (!shouldAutoRedirect || autoRedirectStarted || !oauthProviders[0]) return;

    setAutoRedirectStarted(true);
    void handleOAuthSignIn(oauthProviders[0]);
  }, [autoRedirectStarted, handleOAuthSignIn, oauthProviders, shouldAutoRedirect]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!authClient) return;

    setIsSubmittingCredentials(true);
    setErrorMessage(null);

    try {
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message ?? 'Could not sign in with email and password.');
        return;
      }

      consumeLogoutFlag();
      // Stack.Protected guard handles redirect once session is established
    } catch (error) {
      if (error instanceof Error && error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not sign in with email and password.');
      }
    } finally {
      setIsSubmittingCredentials(false);
    }
  }, [authClient, consumeLogoutFlag, email, password]);

  return (
    <>
      {providersQuery.isLoading && (
        <Card variant="secondary" className="rounded-3xl border border-separator">
          <Card.Body style={[styles.cardBody, styles.centered]}>
            <ActivityIndicator />
            <Text style={{ color: mutedColor }}>Loading sign-in methods...</Text>
          </Card.Body>
        </Card>
      )}

      {providersQuery.error && (
        <Card variant="secondary" className="rounded-3xl border border-separator">
          <Card.Body style={styles.cardBody}>
            <Card.Title style={{ color: dangerColor }}>Could not load providers</Card.Title>
            <Card.Description style={{ color: mutedColor }}>
              Check backend URL and auth server availability, then retry.
            </Card.Description>
            <Button
              onPress={() => {
                void providersQuery.refetch();
              }}
            >
              <Button.Label>Retry</Button.Label>
            </Button>
          </Card.Body>
        </Card>
      )}

      {!providersQuery.isLoading && !providersQuery.error && providers.length === 0 && (
        <Card variant="secondary" className="rounded-3xl border border-separator">
          <Card.Body style={styles.cardBody}>
            <Card.Title style={{ color: foregroundColor }}>No sign-in methods available</Card.Title>
            <Card.Description style={{ color: mutedColor }}>
              Authentication providers are not configured on the backend.
            </Card.Description>
          </Card.Body>
        </Card>
      )}

      {!providersQuery.isLoading && !providersQuery.error && providers.length > 0 && (
        <Card variant="secondary" className="rounded-3xl border border-separator">
          <Card.Body style={styles.cardBody}>
            {credentialProvider && (
              <View style={styles.formSection}>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="Email"
                />
                <Input
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Password"
                />
                <Button
                  isDisabled={!email.trim() || !password || isSubmittingCredentials}
                  onPress={() => {
                    void handlePasswordSubmit();
                  }}
                >
                  <Button.Label>
                    {isSubmittingCredentials ? 'Signing in...' : 'Sign in with password'}
                  </Button.Label>
                </Button>
              </View>
            )}

            {oauthProviders.map((provider) => (
              <Button
                key={provider.id}
                variant="secondary"
                isDisabled={
                  isSubmittingCredentials ||
                  activeOAuthProviderId !== null ||
                  (shouldAutoRedirect && !justLoggedOut && !justLoggedOutFromQuery)
                }
                onPress={() => {
                  void handleOAuthSignIn(provider);
                }}
              >
                <Button.Label>
                  {activeOAuthProviderId === provider.id
                    ? 'Opening provider...'
                    : `Continue with ${provider.name}`}
                </Button.Label>
              </Button>
            ))}
          </Card.Body>
        </Card>
      )}

      {errorMessage && <Text style={[styles.errorText, { color: dangerColor }]}>{errorMessage}</Text>}

      {registrationEnabled && passwordAuthEnabled && (
        <Pressable onPress={() => router.push('/register' as any)} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: mutedColor }]}>
            Don't have an account?{' '}
            <Text style={{ color: accentColor, fontWeight: '600' }}>Sign up</Text>
          </Text>
        </Pressable>
      )}
    </>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { backendBaseUrl, justLoggedOut } = useAuth();

  const [foregroundColor, mutedColor, accentColor, dangerColor] = useThemeColor([
    'foreground',
    'muted',
    'accent',
    'danger',
  ] as const);

  const redirectTo = useMemo(
    () => sanitizeRedirectTarget(firstParam(params.redirectTo as string | string[] | undefined) ?? DEFAULT_PROTECTED_ROUTE),
    [params.redirectTo],
  );

  const justLoggedOutFromQuery =
    firstParam(params.logout as string | string[] | undefined) === 'true';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="always"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCopy}>
        <Text style={[styles.eyebrow, { color: accentColor }]}>Norish</Text>
        <Text style={[styles.title, { color: foregroundColor }]}>Sign in</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>Use your configured auth providers to access your Norish account.</Text>
      </View>

      {(justLoggedOut || justLoggedOutFromQuery) && (
        <Text style={[styles.inlineInfo, { color: mutedColor }]}>You have signed out.</Text>
      )}

      {backendBaseUrl === null ? (
        <Card variant="secondary" className="rounded-3xl border border-separator">
          <Card.Body style={styles.cardBody}>
            <Card.Title style={{ color: dangerColor }}>Backend configuration required</Card.Title>
            <Card.Description style={{ color: mutedColor }}>
              Backend URL is not configured. Open Connect to set your Norish backend URL.
            </Card.Description>
            <Button
              onPress={() => {
                router.replace('/connect');
              }}
            >
              <Button.Label>Open Connect</Button.Label>
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <LoginForm
          backendBaseUrl={backendBaseUrl}
          redirectTo={redirectTo}
          justLoggedOut={justLoggedOut}
          justLoggedOutFromQuery={justLoggedOutFromQuery}
        />
      )}
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
  inlineInfo: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
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
