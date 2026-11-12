import type { AuthClient } from "@/lib/auth/auth-client";
import React, { use } from "react";
import { Text, View } from "react-native";
import { Brand } from "@/components/brand";
import { AuthLayout } from "@/features/auth/components/auth-layout";
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
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { ServerAddressContext } from "@/lib/network/server-address";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Separator, Spinner } from "heroui-native";
import { useIntl } from "react-intl";

import { useAuthProvidersQuery } from "@norish/shared-react/config";

/** A title, a line and at most one action, where the form would be. */
function LoginStatus({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center gap-2">
      <Text className="text-foreground text-center text-[17px] font-semibold">{title}</Text>
      <Text className="text-muted text-center text-[15px] font-normal">{description}</Text>
      {action ? (
        <Button className="mt-4 self-stretch rounded-full" size="lg" onPress={action.onPress}>
          <Button.Label>{action.label}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}

function OrDivider() {
  const intl = useIntl();

  return (
    <View className="mt-5 mb-4 flex-row items-center gap-3">
      <Separator className="flex-1" />
      <Text className="text-muted text-sm font-normal">
        {intl.formatMessage({ id: "auth.login.divider" })}
      </Text>
      <Separator className="flex-1" />
    </View>
  );
}

function SignInMethods({ authClient, redirectTo }: { authClient: AuthClient; redirectTo: string }) {
  const intl = useIntl();
  const config = useAuthProvidersQuery();
  const methods = resolveSignInMethods(config);
  // One attempt across every method, so a password and a provider sign-in never overlap.
  const signIn = useAuthAttempt();

  if (config.isLoading) {
    return <Spinner className="self-center" />;
  }

  if (config.error) {
    return (
      <LoginStatus
        action={{
          label: intl.formatMessage({ id: "common.actions.retry" }),
          onPress: () => void config.refetch(),
        }}
        description={intl.formatMessage({ id: "auth.errors.default.description" })}
        title={intl.formatMessage({ id: "auth.errors.default.title" })}
      />
    );
  }

  if (methods.noMethod) {
    return (
      <LoginStatus
        description={intl.formatMessage({ id: "auth.login.noProviders.contactAdmin" })}
        title={intl.formatMessage({ id: "auth.login.noProviders.title" })}
      />
    );
  }

  return (
    <View>
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
    </View>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const intl = useIntl();
  const params = useLocalSearchParams<{ redirectTo?: string | string[] }>();
  const authClient = useAuthClient();
  const serverAddress = use(ServerAddressContext);
  const redirectTo = sanitizeRedirectTarget(
    firstParam(params.redirectTo) ?? DEFAULT_PROTECTED_ROUTE
  );

  return (
    <AuthLayout footer={serverAddress ? <ServerChip address={serverAddress} /> : null}>
      <Brand compact prefix={intl.formatMessage({ id: "auth.login.title" })} />
      <View className="mt-7">
        {authClient === null ? (
          <LoginStatus
            action={{
              label: intl.formatMessage({ id: "auth.connect.openConnect" }),
              onPress: () => router.replace("/(auth)"),
            }}
            description={intl.formatMessage({ id: "auth.connect.backendRequiredDescription" })}
            title={intl.formatMessage({ id: "auth.connect.backendRequiredTitle" })}
          />
        ) : (
          <SignInMethods authClient={authClient} redirectTo={redirectTo} />
        )}
      </View>
    </AuthLayout>
  );
}
