import type { AuthClient } from "@/lib/auth/auth-client";
import type { ComponentRef } from "react";
import type { TextInput } from "react-native";
import React, { useRef, useState } from "react";
import { View } from "react-native";
import { AuthField } from "@/features/auth/components/auth-field";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { EmailField } from "@/features/auth/components/email-field";
import { HelpPopover } from "@/features/auth/components/help-popover";
import { ErrorShake, InlineError } from "@/features/auth/components/inline-error";
import { PasswordField } from "@/features/auth/components/password-field";
import { useAuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import { validateSignUp } from "@/features/auth/utils/validate-sign-up";
import Feather from "@expo/vector-icons/Feather";
import { InputGroup } from "heroui-native";
import { useIntl } from "react-intl";

/** The attempt key a server-side sign-up runs under; validation runs under the field's name. */
const SIGN_UP = "signUp";

/** Name, email, password with its rule, confirmation, and Create account. */
export function SignUpForm({ authClient }: { authClient: AuthClient }) {
  const intl = useIntl();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const attempt = useAuthAttempt();

  // On success autoSignIn lands the session and the Stack.Protected guard leaves Sign up.
  const handleSubmit = () => {
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
      <AuthField
        error={attempt.failureFor("name")}
        label={intl.formatMessage({ id: "auth.signup.name" })}
      >
        <InputGroup.Input
          autoCapitalize="words"
          autoCorrect={false}
          placeholder={intl.formatMessage({ id: "auth.signup.namePlaceholder" })}
          returnKeyType="next"
          submitBehavior="submit"
          testID="register-name"
          textContentType="name"
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => emailRef.current?.focus()}
        />
      </AuthField>
      <EmailField
        ref={emailRef}
        error={attempt.failureFor("email")}
        label={intl.formatMessage({ id: "auth.signup.email" })}
        placeholder={intl.formatMessage({ id: "auth.signup.emailPlaceholder" })}
        testID="register-email"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <PasswordField
        ref={passwordRef}
        error={attempt.failureFor("password")}
        label={intl.formatMessage({ id: "auth.signup.password" })}
        labelAccessory={
          <HelpPopover
            icon="info.circle"
            label={intl.formatMessage({ id: "auth.signup.passwordHelp" })}
            text={intl.formatMessage({ id: "auth.signup.passwordDescription" })}
          />
        }
        placeholder={intl.formatMessage({ id: "auth.signup.passwordPlaceholder" })}
        returnKeyType="next"
        testID="register-password"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <PasswordField
        ref={confirmRef}
        error={attempt.failureFor("confirmPassword")}
        label={intl.formatMessage({ id: "auth.signup.confirmPassword" })}
        placeholder={intl.formatMessage({ id: "auth.signup.confirmPasswordPlaceholder" })}
        returnKeyType="go"
        testID="register-confirm-password"
        textContentType="newPassword"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        onSubmitEditing={handleSubmit}
      />
      <InlineError error={attempt.failure} />

      <ErrorShake error={attempt.failureFor(SIGN_UP)}>
        <AuthSubmitButton
          icon={(color) => <Feather color={color} name="user-plus" size={20} />}
          isBusy={attempt.running === SIGN_UP}
          isDisabled={attempt.running !== null}
          label={intl.formatMessage({ id: "auth.signup.createAccount" })}
          testID="register-submit"
          onPress={handleSubmit}
        />
      </ErrorShake>
    </View>
  );
}
