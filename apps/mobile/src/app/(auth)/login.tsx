import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text } from "react-native";
import { BackendMissingState } from "@/components/auth/login/backend-missing-state";
import { CredentialForm } from "@/components/auth/login/credential-form";
import { NoProvidersState } from "@/components/auth/login/no-providers-state";
import { OAuthProviderList } from "@/components/auth/login/oauth-provider-list";
import { ProviderErrorState } from "@/components/auth/login/provider-error-state";
import { ProviderLoadingState } from "@/components/auth/login/provider-loading-state";
import { AuthShell } from "@/components/shell/auth-shell";
import { useAuth } from "@/context/auth-context";
import { useAuthProvidersQuery } from "@/hooks/trpc/login/use-auth-providers-query";
import { styles } from "@/styles/login.styles";
import {
  DEFAULT_PROTECTED_ROUTE,
  firstParam,
  sanitizeRedirectTarget,
  toProviderType,
} from "@/util/auth";
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
        await authClient.signIn.social({
          provider: provider.id as any,
          callbackURL: redirectTo,
        });
        consumeLogoutFlag();
      } catch (oauthError) {
        if (oauthError instanceof Error && oauthError.message) {
          setErrorMessage(oauthError.message);
        } else {
          setErrorMessage(intl.formatMessage({ id: "auth.errors.default.description" }));
        }
      } finally {
        setActiveOAuthProviderId(null);
      }
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
        return;
      }

      consumeLogoutFlag();
      // Stack.Protected guard handles redirect once session is established
    } catch (signInError) {
      if (signInError instanceof Error && signInError.message) {
        setErrorMessage(signInError.message);
      } else {
        setErrorMessage(intl.formatMessage({ id: "auth.emailPassword.errors.generic" }));
      }
    } finally {
      setIsSubmittingCredentials(false);
    }
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
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              isSubmitting={isSubmittingCredentials}
              onSubmit={() => {
                void handlePasswordSubmit();
              }}
            />
          )}

          <OAuthProviderList
            providers={oauthProviders}
            activeProviderId={activeOAuthProviderId}
            isDisabled={isSubmittingCredentials || activeOAuthProviderId !== null}
            onPress={(provider) => {
              void handleOAuthSignIn(provider);
            }}
          />
        </>
      )}

      {errorMessage && (
        <Text style={[styles.errorText, { color: dangerColor }]}>{errorMessage}</Text>
      )}

      {registrationEnabled && passwordAuthEnabled && (
        <Pressable onPress={() => router.push("/register" as any)} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: mutedColor }]}>
            {intl.formatMessage({ id: "auth.emailPassword.noAccount" })}{" "}
            <Text style={{ color: accentColor }} className="font-semibold">
              {intl.formatMessage({ id: "auth.emailPassword.signUp" })}
            </Text>
          </Text>
        </Pressable>
      )}
    </>
  );
}

export default function LoginScreen() {
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
          onPress={() => {
            router.push("/(auth)");
          }}
          style={styles.linkRow}
        >
          <Text style={[styles.linkText, { color: mutedColor }]}>
            {intl.formatMessage({ id: "auth.login.wrongServer" })}{" "}
            <Text style={{ color: accentColor }} className="font-semibold">
              {intl.formatMessage({ id: "auth.login.changeServer" })}
            </Text>
          </Text>
        </Pressable>
      )}
    </>
  );

  return (
    <AuthShell headingPrefix={intl.formatMessage({ id: "auth.login.title" })} footer={footer}>
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
