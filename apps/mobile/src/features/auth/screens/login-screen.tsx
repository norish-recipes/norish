import type { AuthClient } from "@/lib/auth/auth-client";
import type { ReactNode } from "react";
import React, { use } from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Brand } from "@/components/brand";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { PasswordForm } from "@/features/auth/components/password-form";
import { ProviderButtons } from "@/features/auth/components/provider-buttons";
import { ServerChip } from "@/features/auth/components/server-chip";
import { useAuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import { FADE_IN } from "@/features/auth/utils/motion";
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

/** The brand, "Sign in to" and what sits under it, fading in once where they stay. */
function SignInBlock({ children }: { children: ReactNode }) {
  const intl = useIntl();

  return (
    <Animated.View entering={FADE_IN}>
      <Brand compact prefix={intl.formatMessage({ id: "auth.login.title" })} />
      <View className="mt-7">{children}</View>
    </Animated.View>
  );
}

function SignInMethods({ authClient, redirectTo }: { authClient: AuthClient; redirectTo: string }) {
  const intl = useIntl();
  const config = useAuthProvidersQuery();
  const methods = resolveSignInMethods(config);
  // One attempt across every method, so a password and a provider sign-in never overlap.
  const signIn = useAuthAttempt();

  // The spinner stands alone, so the block never moves when the methods replace it.
  if (config.isLoading) {
    return <Spinner className="self-center" />;
  }

  // A failed background refetch leaves loaded methods up, so the form keeps its state.
  if (config.error && !config.hasData) {
    return (
      <SignInBlock>
        <LoginStatus
          action={{
            label: intl.formatMessage({ id: "common.actions.retry" }),
            onPress: () => void config.refetch(),
          }}
          description={intl.formatMessage({ id: "auth.errors.default.description" })}
          title={intl.formatMessage({ id: "auth.errors.default.title" })}
        />
      </SignInBlock>
    );
  }

  if (methods.noMethod) {
    return (
      <SignInBlock>
        <LoginStatus
          description={intl.formatMessage({ id: "auth.login.noProviders.contactAdmin" })}
          title={intl.formatMessage({ id: "auth.login.noProviders.title" })}
        />
      </SignInBlock>
    );
  }

  return (
    <SignInBlock>
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
    </SignInBlock>
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
      {authClient === null ? (
        <SignInBlock>
          <LoginStatus
            action={{
              label: intl.formatMessage({ id: "auth.connect.openConnect" }),
              onPress: () => router.replace("/(auth)"),
            }}
            description={intl.formatMessage({ id: "auth.connect.backendRequiredDescription" })}
            title={intl.formatMessage({ id: "auth.connect.backendRequiredTitle" })}
          />
        </SignInBlock>
      ) : (
        <SignInMethods authClient={authClient} redirectTo={redirectTo} />
      )}
    </AuthLayout>
  );
}
