import type { AuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import type { AuthClient } from "@/lib/auth/auth-client";
import type { ComponentRef } from "react";
import type { TextInput } from "react-native";
import React, { useRef, useState } from "react";
import { View } from "react-native";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { EmailField } from "@/features/auth/components/email-field";
import { InlineError } from "@/features/auth/components/inline-error";
import { PasswordField } from "@/features/auth/components/password-field";
import { SIGN_IN_DEADLINE_MS } from "@/features/auth/utils/auth-failure";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

/** The attempt key a password sign-in runs under; providers run under their id. */
const PASSWORD = "password";

interface PasswordFormProps {
  authClient: AuthClient;
  signIn: AuthAttempt;
  showSignUpLink: boolean;
}

/** Email and password, the link to Sign up, and Sign in. */
export function PasswordForm({ authClient, signIn, showSignUpLink }: PasswordFormProps) {
  const router = useRouter();
  const intl = useIntl();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const error = signIn.failureFor(PASSWORD);
  const isFilled = email.trim() !== "" && password !== "";

  // On success the Stack.Protected guard leaves Sign in once the session lands.
  const handleSubmit = () => {
    if (!isFilled) return;

    void signIn.attempt(PASSWORD, () =>
      authClient.signIn.email({
        email: email.trim(),
        password,
        fetchOptions: { timeout: SIGN_IN_DEADLINE_MS },
      })
    );
  };

  return (
    <View className="gap-3.5">
      <EmailField
        error={error}
        label={intl.formatMessage({ id: "auth.emailPassword.email" })}
        placeholder={intl.formatMessage({ id: "auth.emailPassword.emailPlaceholder" })}
        testID="login-email"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordInputRef.current?.focus()}
      />
      <PasswordField
        ref={passwordInputRef}
        revealable
        error={error}
        label={intl.formatMessage({ id: "auth.emailPassword.password" })}
        placeholder={intl.formatMessage({ id: "auth.emailPassword.passwordPlaceholder" })}
        returnKeyType="go"
        testID="login-password"
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleSubmit}
      />
      <InlineError error={error} />

      {showSignUpLink ? (
        <AuthFooterLink
          className="mt-0.5 self-center"
          lead={intl.formatMessage({ id: "auth.emailPassword.noAccount" })}
          link={intl.formatMessage({ id: "auth.emailPassword.signUp" })}
          onPress={() => router.push("/register")}
        />
      ) : null}

      <AuthSubmitButton
        icon={(color) => <Feather color={color} name="log-in" size={20} />}
        isBusy={signIn.running === PASSWORD}
        isDisabled={!isFilled || signIn.running !== null}
        label={intl.formatMessage({ id: "auth.emailPassword.signIn" })}
        testID="login-submit"
        onPress={handleSubmit}
      />
    </View>
  );
}
