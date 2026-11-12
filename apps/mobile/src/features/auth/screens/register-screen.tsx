import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { Brand } from "@/components/brand";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { AuthStatus } from "@/features/auth/components/auth-status";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useAuthProvidersQuery } from "@norish/shared-react/config";

/** "Sign up for" over the logo, with what sits under it. */
function SignUpBlock({ children }: { children: ReactNode }) {
  const intl = useIntl();

  return (
    <>
      <Brand compact prefix={intl.formatMessage({ id: "auth.signup.title" })} slogan={false} />
      <View className="mt-7">{children}</View>
    </>
  );
}

export function RegisterScreen() {
  const router = useRouter();
  const intl = useIntl();
  const authClient = useAuthClient();
  const { registrationEnabled, hasData } = useAuthProvidersQuery();

  const signInLink = (
    <AuthFooterLink
      className="items-center self-center pb-2"
      lead={intl.formatMessage({ id: "auth.signup.hasAccount" })}
      link={intl.formatMessage({ id: "auth.signup.signIn" })}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/login"))}
    />
  );

  if (authClient === null) {
    return (
      <AuthLayout footer={signInLink}>
        <SignUpBlock>
          <AuthStatus
            action={{
              label: intl.formatMessage({ id: "auth.connect.openConnect" }),
              onPress: () => router.replace("/(auth)"),
            }}
            description={intl.formatMessage({ id: "auth.connect.backendRequiredDescription" })}
            title={intl.formatMessage({ id: "auth.connect.backendRequiredTitle" })}
          />
        </SignUpBlock>
      </AuthLayout>
    );
  }

  // A server that reports sign-ups closed gets no form to fill in for nothing.
  if (hasData && !registrationEnabled) {
    return (
      <AuthLayout footer={signInLink}>
        <SignUpBlock>
          <AuthStatus
            description={intl.formatMessage({ id: "auth.signup.errors.closed" })}
            title={intl.formatMessage({
              id: "auth.errors.registration_is_currently_disabled.title",
            })}
          />
        </SignUpBlock>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout footer={signInLink}>
      <SignUpBlock>
        <SignUpForm authClient={authClient} />
      </SignUpBlock>
    </AuthLayout>
  );
}
