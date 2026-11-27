import type { AuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import type { AuthClient } from "@/lib/auth/auth-client";
import type { ComponentRef, ReactNode } from "react";
import type { TextInput } from "react-native";
import React, { useRef, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { AuthField } from "@/features/auth/components/auth-field";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { EmailField } from "@/features/auth/components/email-field";
import { HelpPopover } from "@/features/auth/components/help-popover";
import { ErrorShake, InlineError } from "@/features/auth/components/inline-error";
import { PasswordField } from "@/features/auth/components/password-field";
import { SIGN_IN_DEADLINE_MS } from "@/features/auth/utils/auth-failure";
import { MODE_ROW_IN, MODE_ROW_OUT } from "@/features/auth/utils/motion";
import { validateSignUp } from "@/features/auth/utils/validate-sign-up";
import { SPRING_LAYOUT } from "@/lib/motion/layout";
import Feather from "@expo/vector-icons/Feather";
import { useIntl } from "react-intl";

export type AuthMode = "sign-in" | "sign-up";

/** The attempt keys a password sign-in and a sign-up run under; validation runs under the field's name. */
const PASSWORD = "password";
const SIGN_UP = "signUp";

/** A row that springs to its new place as the other mode's rows join or leave around it. */
export function ModeRow({
  shown = true,
  className,
  children,
}: {
  shown?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!shown) return null;

  return (
    <Animated.View
      className={className}
      entering={MODE_ROW_IN}
      exiting={MODE_ROW_OUT}
      layout={SPRING_LAYOUT}
    >
      {children}
    </Animated.View>
  );
}

interface PasswordFormProps {
  authClient: AuthClient;
  attempt: AuthAttempt;
  mode: AuthMode;
  /** Whether the server takes sign-ups, so Sign in links to Sign up. */
  signUpOpen: boolean;
  onModeChange: (mode: AuthMode) => void;
}

/** Sign in's email and password; Sign up adds a name above and a confirmation below them. */
export function PasswordForm({
  authClient,
  attempt,
  mode,
  signUpOpen,
  onModeChange,
}: PasswordFormProps) {
  const intl = useIntl();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const signingUp = mode === "sign-up";
  const ids = signingUp ? "register" : "login";
  const isFilled = email.trim() !== "" && password !== "";
  const signInError = attempt.failureFor(PASSWORD);

  // On success the session lands and the Stack.Protected guard leaves the signed-out stack.
  const handleSubmit = () => {
    if (!signingUp) {
      if (!isFilled) return;

      void attempt.attempt(PASSWORD, () =>
        authClient.signIn.email({
          email: email.trim(),
          password,
          fetchOptions: { timeout: SIGN_IN_DEADLINE_MS },
        })
      );

      return;
    }

    const invalid = validateSignUp({ name, email, password, confirmPassword });

    if (invalid) {
      void attempt.run(invalid.field, () => Promise.resolve(invalid.messageId));

      return;
    }

    // No deadline: a slow server may still be creating the Account.
    void attempt.attempt(
      SIGN_UP,
      () => authClient.signUp.email({ name: name.trim(), email: email.trim(), password }),
      "auth.signup.errors.createFailed"
    );
  };

  return (
    <View className="gap-3.5">
      <ModeRow shown={signingUp}>
        <AuthField
          compact
          autoCapitalize="words"
          autoCorrect={false}
          error={attempt.failureFor("name")}
          label={intl.formatMessage({ id: "auth.signup.name" })}
          placeholder={intl.formatMessage({ id: "auth.signup.namePlaceholder" })}
          returnKeyType="next"
          submitBehavior="submit"
          testID="register-name"
          textContentType="name"
          value={name}
          onChangeText={attempt.edit(setName)}
          onSubmitEditing={() => emailRef.current?.focus()}
        />
      </ModeRow>
      <ModeRow>
        <EmailField
          ref={emailRef}
          error={signingUp ? attempt.failureFor("email") : signInError}
          label={intl.formatMessage({ id: "auth.emailPassword.email" })}
          placeholder={intl.formatMessage({ id: "auth.emailPassword.emailPlaceholder" })}
          testID={`${ids}-email`}
          value={email}
          onChangeText={attempt.edit(setEmail)}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </ModeRow>
      <ModeRow>
        <PasswordField
          ref={passwordRef}
          revealable
          error={signingUp ? attempt.failureFor("password") : signInError}
          label={intl.formatMessage({ id: "auth.emailPassword.password" })}
          labelAccessory={
            signingUp ? (
              <HelpPopover
                icon="info.circle"
                label={intl.formatMessage({ id: "auth.signup.passwordHelp" })}
                text={intl.formatMessage({ id: "auth.signup.passwordDescription" })}
              />
            ) : null
          }
          placeholder={intl.formatMessage({
            id: signingUp
              ? "auth.signup.passwordPlaceholder"
              : "auth.emailPassword.passwordPlaceholder",
          })}
          returnKeyType={signingUp ? "next" : "go"}
          testID={`${ids}-password`}
          textContentType={signingUp ? "newPassword" : "password"}
          value={password}
          onChangeText={attempt.edit(setPassword)}
          onSubmitEditing={signingUp ? () => confirmRef.current?.focus() : handleSubmit}
        />
      </ModeRow>
      <ModeRow shown={signingUp}>
        <PasswordField
          ref={confirmRef}
          error={attempt.failureFor("confirmPassword")}
          label={intl.formatMessage({ id: "auth.signup.confirmPassword" })}
          placeholder={intl.formatMessage({ id: "auth.signup.confirmPasswordPlaceholder" })}
          returnKeyType="go"
          testID="register-confirm-password"
          textContentType="newPassword"
          value={confirmPassword}
          onChangeText={attempt.edit(setConfirmPassword)}
          onSubmitEditing={handleSubmit}
        />
      </ModeRow>
      <ModeRow>
        <InlineError error={signingUp ? attempt.failure : signInError} testID={`${ids}-error`} />
      </ModeRow>

      {signUpOpen ? (
        <ModeRow className="mt-0.5 self-center">
          <AuthFooterLink
            lead={intl.formatMessage({
              id: signingUp ? "auth.signup.hasAccount" : "auth.emailPassword.noAccount",
            })}
            link={intl.formatMessage({
              id: signingUp ? "auth.signup.signIn" : "auth.emailPassword.signUp",
            })}
            testID={signingUp ? "register-sign-in-link" : "login-sign-up-link"}
            onPress={() => onModeChange(signingUp ? "sign-in" : "sign-up")}
          />
        </ModeRow>
      ) : null}

      <ModeRow>
        <ErrorShake error={attempt.failureFor(SIGN_UP)}>
          <AuthSubmitButton
            icon={(color) => (
              <Feather color={color} name={signingUp ? "user-plus" : "log-in"} size={20} />
            )}
            isBusy={attempt.running === (signingUp ? SIGN_UP : PASSWORD)}
            isDisabled={(!signingUp && !isFilled) || attempt.running !== null}
            label={intl.formatMessage({
              id: signingUp ? "auth.signup.createAccount" : "auth.emailPassword.signIn",
            })}
            testID={`${ids}-submit`}
            onPress={handleSubmit}
          />
        </ErrorShake>
      </ModeRow>
    </View>
  );
}
