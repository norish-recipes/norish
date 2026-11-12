import React from "react";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { AuthGate } from "@/features/auth/components/auth-gate";
import { AuthStatus } from "@/features/auth/components/auth-status";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { SIGN_IN_HREF } from "@/features/auth/utils/hrefs";
import { isSignUpOpen } from "@/features/auth/utils/sign-in-methods";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

export function RegisterScreen() {
  const router = useRouter();
  const intl = useIntl();

  return (
    <AuthGate
      underHeader
      footer={
        <AuthFooterLink
          className="self-center"
          lead={intl.formatMessage({ id: "auth.signup.hasAccount" })}
          link={intl.formatMessage({ id: "auth.signup.signIn" })}
          testID="register-sign-in-link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace(SIGN_IN_HREF))}
        />
      }
      slogan={false}
      titleId="auth.signup.title"
    >
      {(authClient, config) =>
        // A server that closed sign-ups gets no form to fill in for nothing.
        isSignUpOpen(config) ? (
          <SignUpForm authClient={authClient} />
        ) : (
          <AuthStatus
            description={intl.formatMessage({ id: "auth.signup.errors.closed" })}
            title={intl.formatMessage({
              id: "auth.errors.registration_is_currently_disabled.title",
            })}
          />
        )
      }
    </AuthGate>
  );
}
