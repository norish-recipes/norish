import type { AuthClient } from "@/lib/auth/auth-client";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text } from "react-native";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { BackendMissingState } from "@/features/auth/components/backend-missing-state";
import { CredentialForm } from "@/features/auth/components/credential-form";
import { NoProvidersState } from "@/features/auth/components/no-providers-state";
import { OAuthProviderList } from "@/features/auth/components/oauth-provider-list";
import { ProviderErrorState } from "@/features/auth/components/provider-error-state";
import { ProviderLoadingState } from "@/features/auth/components/provider-loading-state";
import { styles } from "@/features/auth/styles/login.styles";
import { authFailure } from "@/features/auth/utils/auth-failure";
import {
  DEFAULT_PROTECTED_ROUTE,
  firstParam,
  sanitizeRedirectTarget,
  toProviderType,
} from "@/features/auth/utils/redirect";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ProviderInfo } from "@norish/shared/contracts";
import { useAuthProvidersQuery } from "@norish/shared-react/config";

function LoginForm({ authClient, redirectTo }: { authClient: AuthClient; redirectTo: string }) {
  const router = useRouter();
  const intl = useIntl();
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
      setErrorMessage(null);
      setActiveOAuthProviderId(provider.id);

      const failure = await authFailure(
        authClient.signIn.social({ provider: provider.id, callbackURL: redirectTo }),
        intl.formatMessage({ id: "auth.errors.default.description" })
      );

      if (failure !== null) setErrorMessage(failure);

      setActiveOAuthProviderId(null);
    },
    [authClient, intl, redirectTo]
  );

  const handlePasswordSubmit = useCallback(async () => {
    setIsSubmittingCredentials(true);
    setErrorMessage(null);

    const failure = await authFailure(
      authClient.signIn.email({ email: email.trim(), password }),
      intl.formatMessage({ id: "auth.emailPassword.errors.generic" })
    );

    // Stack.Protected guard handles redirect once session is established
    if (failure !== null) setErrorMessage(failure);

    setIsSubmittingCredentials(false);
  }, [authClient, email, intl, password]);

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
  const authClient = useAuthClient();

  const [mutedColor, accentColor] = useThemeColor(["muted", "accent"] as const);

  const redirectTo = useMemo(
    () =>
      sanitizeRedirectTarget(
        firstParam(params.redirectTo as string | string[] | undefined) ?? DEFAULT_PROTECTED_ROUTE
      ),
    [params.redirectTo]
  );

  const footer = (
    <>
      {authClient !== null && (
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
      {authClient === null ? (
        <BackendMissingState
          onOpenConnect={() => {
            router.replace("/(auth)");
          }}
        />
      ) : (
        <LoginForm authClient={authClient} redirectTo={redirectTo} />
      )}
    </AuthShell>
  );
}
