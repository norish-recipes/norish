import type { AuthConfig } from "@/features/auth/components/auth-gate";
import type { AuthClient } from "@/lib/auth/auth-client";
import React, { use } from "react";
import { Text, View } from "react-native";
import { AuthGate } from "@/features/auth/components/auth-gate";
import { AuthStatus } from "@/features/auth/components/auth-status";
import { PasswordForm } from "@/features/auth/components/password-form";
import { ProviderButtons } from "@/features/auth/components/provider-buttons";
import { ServerChip } from "@/features/auth/components/server-chip";
import { useAuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import {
  DEFAULT_PROTECTED_ROUTE,
  firstParam,
  sanitizeRedirectTarget,
} from "@/features/auth/utils/redirect";
import { resolveSignInMethods } from "@/features/auth/utils/sign-in-methods";
import { ServerAddressContext } from "@/lib/network/server-address";
import { useLocalSearchParams } from "expo-router";
import { Separator } from "heroui-native";
import { useIntl } from "react-intl";

function OrDivider() {
  const intl = useIntl();

  return (
    <View className="mt-5 mb-4 flex-row items-center gap-3">
      <Separator className="bg-border h-px flex-1" />
      <Text className="text-muted text-sm font-normal">
        {intl.formatMessage({ id: "auth.login.divider" })}
      </Text>
      <Separator className="bg-border h-px flex-1" />
    </View>
  );
}

function SignInMethods({
  authClient,
  config,
  redirectTo,
}: {
  authClient: AuthClient;
  config: AuthConfig;
  redirectTo: string;
}) {
  const intl = useIntl();
  const methods = resolveSignInMethods(config);
  // One attempt across every method, so a password and a provider sign-in never overlap.
  const signIn = useAuthAttempt();

  if (methods.noMethod) {
    return (
      <AuthStatus
        description={intl.formatMessage({ id: "auth.login.noProviders.contactAdmin" })}
        title={intl.formatMessage({ id: "auth.login.noProviders.title" })}
      />
    );
  }

  return (
    <>
      {methods.passwordForm ? (
        <PasswordForm authClient={authClient} showSignUpLink={methods.signUp} signIn={signIn} />
      ) : null}
      {methods.divider ? <OrDivider /> : null}
      {methods.providerButtons ? (
        <ProviderButtons
          authClient={authClient}
          providers={methods.oauthProviders}
          redirectTo={redirectTo}
          signIn={signIn}
        />
      ) : null}
    </>
  );
}

/** `fadeIn` holds the whole screen back until it has loaded, then fades it in as one. */
export function LoginScreen({ fadeIn = false }: { fadeIn?: boolean }) {
  const params = useLocalSearchParams<{ redirectTo?: string | string[] }>();
  const serverAddress = use(ServerAddressContext);
  const redirectTo = sanitizeRedirectTarget(
    firstParam(params.redirectTo) ?? DEFAULT_PROTECTED_ROUTE
  );

  return (
    <AuthGate
      slogan
      fadeIn={fadeIn}
      footer={serverAddress ? <ServerChip address={serverAddress} /> : null}
      titleId="auth.login.title"
      topAligned={(config) => !resolveSignInMethods(config).noMethod}
    >
      {(authClient, config) => (
        <SignInMethods authClient={authClient} config={config} redirectTo={redirectTo} />
      )}
    </AuthGate>
  );
}
