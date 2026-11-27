import type { AuthConfig } from "@/features/auth/components/auth-gate";
import type { AuthMode } from "@/features/auth/components/password-form";
import type { AuthClient } from "@/lib/auth/auth-client";
import React, { use, useState } from "react";
import { Text, View } from "react-native";
import { LayoutAnimationConfig } from "react-native-reanimated";
import { AuthGate } from "@/features/auth/components/auth-gate";
import { AuthStatus } from "@/features/auth/components/auth-status";
import { ModeRow, PasswordForm } from "@/features/auth/components/password-form";
import { ProviderButtons } from "@/features/auth/components/provider-buttons";
import { ServerChip } from "@/features/auth/components/server-chip";
import { useAuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import { redirectTargetOf } from "@/features/auth/utils/redirect";
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
  mode,
  onModeChange,
}: {
  authClient: AuthClient;
  config: AuthConfig;
  redirectTo: string;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
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

  // A server that closes sign-ups while Sign up is open falls back to Sign in.
  const signingUp = mode === "sign-up" && methods.signUp;

  return (
    // The rows animate only as the mode changes, not as the screen arrives or leaves.
    <LayoutAnimationConfig skipEntering skipExiting>
      {methods.passwordForm ? (
        <PasswordForm
          attempt={signIn}
          authClient={authClient}
          mode={signingUp ? "sign-up" : "sign-in"}
          signUpOpen={methods.signUp}
          onModeChange={signIn.edit(onModeChange)}
        />
      ) : null}
      <ModeRow shown={!signingUp}>
        {methods.divider ? <OrDivider /> : null}
        {methods.providerButtons ? (
          <ProviderButtons
            authClient={authClient}
            providers={methods.oauthProviders}
            redirectTo={redirectTo}
            signIn={signIn}
          />
        ) : null}
      </ModeRow>
    </LayoutAnimationConfig>
  );
}

/** Sign in, and Sign up as the same screen with more fields. `fadeIn` holds the whole screen back until it has loaded, then fades it in as one. */
export function LoginScreen({ fadeIn = false }: { fadeIn?: boolean }) {
  const params = useLocalSearchParams<{ redirectTo?: string | string[] }>();
  const serverAddress = use(ServerAddressContext);
  const redirectTo = redirectTargetOf(params.redirectTo);
  const [mode, setMode] = useState<AuthMode>("sign-in");

  return (
    <AuthGate
      fadeIn={fadeIn}
      footer={serverAddress ? <ServerChip address={serverAddress} /> : null}
      titleId={mode === "sign-up" ? "auth.signup.title" : "auth.login.title"}
      topAligned={(config) => !resolveSignInMethods(config).noMethod}
    >
      {(authClient, config) => (
        <SignInMethods
          authClient={authClient}
          config={config}
          mode={mode}
          redirectTo={redirectTo}
          onModeChange={setMode}
        />
      )}
    </AuthGate>
  );
}
