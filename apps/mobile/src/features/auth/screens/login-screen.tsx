import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text } from "react-native";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { BackendMissingState } from "@/features/auth/components/backend-missing-state";
import { CredentialForm } from "@/features/auth/components/credential-form";
import { NoProvidersState } from "@/features/auth/components/no-providers-state";
import { OAuthProviderList } from "@/features/auth/components/oauth-provider-list";
import { ProviderErrorState } from "@/features/auth/components/provider-error-state";
import { ProviderLoadingState } from "@/features/auth/components/provider-loading-state";
import { useAuthProvidersQuery } from "@/features/auth/hooks/use-auth-providers-query";
import { styles } from "@/features/auth/styles/login.styles";
import {
  DEFAULT_PROTECTED_ROUTE,
  firstParam,
  sanitizeRedirectTarget,
  toProviderType,
} from "@/features/auth/utils/redirect";
import { useAuth } from "@/lib/auth/auth-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ProviderInfo } from "@norish/shared/contracts";

function LoginForm({ backendBaseUrl, redirectTo }: { backendBaseUrl: string; redirectTo: string }) {
  const router = useRouter();
  const intl = useIntl();
  const { authClient, consumeLogoutFlag } = useAuth();
  const [mutedColor, dangerColor, accentColor] = useThemeColor([
    "muted",
    "danger",
    "accent",
  ] as const);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmittingCredentials, setIsSubmittingCredentials] = useState(false);
  const [activeOAuthProviderId, setActiveOAuthProviderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { providers, registrationEnabled, passwordAuthEnabled, isLoading, error, refetch } =
    useAuthProvidersQuery();
  const credentialProvider = providers.find(
    (provider) => toProviderType(provider) === "credential"
  );
  const oauthProviders = providers.filter((provider) => toProviderType(provider) === "oauth");

  const handleOAuthSignIn = useCallback(
    async (provider: ProviderInfo) => {
      if (!authClient || !backendBaseUrl) return;

      setErrorMessage(null);
      setActiveOAuthProviderId(provider.id);

      try {
        // Like signIn.email, a refused sign-in comes back as `error`; only a network failure throws.
        const { error: signInError } = await authClient.signIn.social({
          provider: provider.id,
          callbackURL: redirectTo,
        });

        if (signInError) {
          setErrorMessage(
            signInError.message ?? intl.formatMessage({ id: "auth.errors.default.description" })
          );
        } else {
          consumeLogoutFlag();
        }
      } catch (oauthError) {
        if (oauthError instanceof Error && oauthError.message) {
          setErrorMessage(oauthError.message);
        } else {
          setErrorMessage(intl.formatMessage({ id: "auth.errors.default.description" }));
        }
      }

      setActiveOAuthProviderId(null);
    },
    [authClient, backendBaseUrl, consumeLogoutFlag, intl, redirectTo]
  );

  const handlePasswordSubmit = useCallback(async () => {
    if (!authClient) return;

    setIsSubmittingCredentials(true);
    setErrorMessage(null);

    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setErrorMessage(
          signInError.message ?? intl.formatMessage({ id: "auth.emailPassword.errors.generic" })
        );
      } else {
        consumeLogoutFlag();
      }
      // Stack.Protected guard handles redirect once session is established
    } catch (signInError) {
      if (signInError instanceof Error && signInError.message) {
        setErrorMessage(signInError.message);
      } else {
        setErrorMessage(intl.formatMessage({ id: "auth.emailPassword.errors.generic" }));
      }
    }

    setIsSubmittingCredentials(false);
  }, [authClient, consumeLogoutFlag, email, intl, password]);

  return (
    <>
      {isLoading && <ProviderLoadingState />}

      {error && (
        <ProviderErrorState
          onRetry={() => {
            void refetch();
          }}
        />
      )}

      {!isLoading && !error && providers.length === 0 && <NoProvidersState />}

      {!isLoading && !error && providers.length > 0 && (
        <>
          {credentialProvider && (
            <CredentialForm
              email={email}
              isSubmitting={isSubmittingCredentials}
              password={password}
              setEmail={setEmail}
              setPassword={setPassword}
              onSubmit={() => {
                void handlePasswordSubmit();
              }}
            />
          )}

          <OAuthProviderList
            activeProviderId={activeOAuthProviderId}
            isDisabled={isSubmittingCredentials || activeOAuthProviderId !== null}
            providers={oauthProviders}
            onPress={(provider) => {
              void handleOAuthSignIn(provider);
            }}
          />
        </>
      )}

      {errorMessage && (
        <Text className="font-medium" style={[styles.errorText, { color: dangerColor }]}>
          {errorMessage}
        </Text>
      )}

      {registrationEnabled && passwordAuthEnabled && (
        <Pressable style={styles.linkRow} onPress={() => router.push("/register")}>
          <Text className="font-normal" style={[styles.linkText, { color: mutedColor }]}>
            {intl.formatMessage({ id: "auth.emailPassword.noAccount" })}{" "}
            <Text className="font-semibold" style={{ color: accentColor }}>
              {intl.formatMessage({ id: "auth.emailPassword.signUp" })}
            </Text>
          </Text>
        </Pressable>
      )}
    </>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const intl = useIntl();
  const params = useLocalSearchParams();
  const { backendBaseUrl, justLoggedOut } = useAuth();

  const [mutedColor, accentColor] = useThemeColor(["muted", "accent"] as const);

  const redirectTo = useMemo(
    () =>
      sanitizeRedirectTarget(
        firstParam(params.redirectTo as string | string[] | undefined) ?? DEFAULT_PROTECTED_ROUTE
      ),
    [params.redirectTo]
  );

  const justLoggedOutFromQuery =
    firstParam(params.logout as string | string[] | undefined) === "true";

  const footer = (
    <>
      {backendBaseUrl !== null && (
        <Pressable
          style={styles.linkRow}
          onPress={() => {
            router.push("/(auth)");
          }}
        >
          <Text className="font-normal" style={[styles.linkText, { color: mutedColor }]}>
            {intl.formatMessage({ id: "auth.login.wrongServer" })}{" "}
            <Text className="font-semibold" style={{ color: accentColor }}>
              {intl.formatMessage({ id: "auth.login.changeServer" })}
            </Text>
          </Text>
        </Pressable>
      )}
    </>
  );

  return (
    <AuthShell footer={footer} headingPrefix={intl.formatMessage({ id: "auth.login.title" })}>
      {backendBaseUrl === null ? (
        <BackendMissingState
          onOpenConnect={() => {
            router.replace("/(auth)");
          }}
        />
      ) : (
        <LoginForm backendBaseUrl={backendBaseUrl} redirectTo={redirectTo} />
      )}
    </AuthShell>
  );
}
