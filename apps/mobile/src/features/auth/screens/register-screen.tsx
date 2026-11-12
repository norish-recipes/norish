import type { AuthClient } from "@/lib/auth/auth-client";
import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Brand } from "@/components/brand";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { styles } from "@/features/auth/styles/register.styles";
import { authFailure } from "@/features/auth/utils/auth-failure";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useRouter } from "expo-router";
import { Button, Card, Input, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useAuthProvidersQuery } from "@norish/shared-react/config";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export function RegisterScreen() {
  const router = useRouter();
  const intl = useIntl();
  const authClient = useAuthClient();

  const [foregroundColor, mutedColor, accentColor, dangerColor] = useThemeColor([
    "foreground",
    "muted",
    "accent",
    "danger",
  ] as const);

  if (authClient === null) {
    return (
      <AuthLayout>
        <Brand prefix={intl.formatMessage({ id: "auth.signup.title" })} slogan={false} />
        <View className="mt-7 gap-3">
          <View style={styles.centered}>
            <Button
              onPress={() => {
                router.replace("/(auth)");
              }}
            >
              <Button.Label>{intl.formatMessage({ id: "auth.errors.backToLogin" })}</Button.Label>
            </Button>
          </View>
        </View>
      </AuthLayout>
    );
  }

  return (
    <RegisterForm
      accentColor={accentColor}
      authClient={authClient}
      dangerColor={dangerColor}
      foregroundColor={foregroundColor}
      mutedColor={mutedColor}
    />
  );
}

function RegisterForm({
  authClient,
  foregroundColor,
  mutedColor,
  accentColor,
  dangerColor,
}: {
  authClient: AuthClient;
  foregroundColor: string;
  mutedColor: string;
  accentColor: string;
  dangerColor: string;
}) {
  const router = useRouter();
  const intl = useIntl();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { registrationEnabled, hasData } = useAuthProvidersQuery();

  const handleSignUp = useCallback(async () => {
    setErrorMessage(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setErrorMessage(intl.formatMessage({ id: "common.validation.required" }));

      return;
    }

    if (!trimmedEmail) {
      setErrorMessage(intl.formatMessage({ id: "common.validation.required" }));

      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(intl.formatMessage({ id: "auth.signup.errors.passwordTooShort" }));

      return;
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      setErrorMessage(intl.formatMessage({ id: "auth.signup.errors.passwordTooLong" }));

      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(intl.formatMessage({ id: "auth.signup.errors.passwordMismatch" }));

      return;
    }

    setIsSubmitting(true);

    const failure = await authFailure(
      authClient.signUp.email({ name: trimmedName, email: trimmedEmail, password }),
      "auth.signup.errors.createFailed"
    );

    // autoSignIn establishes the session; Stack.Protected redirects to the smoke screen.
    if (failure !== null) setErrorMessage(intl.formatMessage({ id: failure }));

    setIsSubmitting(false);
  }, [authClient, confirmPassword, email, intl, name, password]);

  const signInLink = (
    <Pressable style={styles.linkRow} onPress={() => router.replace("/login")}>
      <Text className="font-normal" style={[styles.linkText, { color: mutedColor }]}>
        {intl.formatMessage({ id: "auth.signup.hasAccount" })}{" "}
        <Text className="font-semibold" style={{ color: accentColor }}>
          {intl.formatMessage({ id: "auth.signup.signIn" })}
        </Text>
      </Text>
    </Pressable>
  );

  // If we've loaded the providers and registration is not enabled, show a message
  if (hasData && !registrationEnabled) {
    return (
      <AuthLayout>
        <Brand
          prefix={intl.formatMessage({
            id: "auth.errors.registration_is_currently_disabled.title",
          })}
          slogan={false}
        />
        <View className="mt-7 gap-3">
          <Card.Title style={{ color: foregroundColor }}>
            {intl.formatMessage({ id: "auth.errors.registration_is_currently_disabled.title" })}
          </Card.Title>
          <Card.Description style={{ color: mutedColor }}>
            {intl.formatMessage({
              id: "auth.errors.registration_is_currently_disabled.description",
            })}
          </Card.Description>
        </View>
        {signInLink}
      </AuthLayout>
    );
  }

  const passwordsMatch = password === confirmPassword;
  const isFormValid = name.trim() && email.trim() && password && confirmPassword && passwordsMatch;

  return (
    <AuthLayout>
      <Brand prefix={intl.formatMessage({ id: "auth.signup.title" })} slogan={false} />
      <View className="mt-7 gap-3">
        <View style={styles.formSection}>
          <Input
            autoCapitalize="words"
            autoCorrect={false}
            placeholder={intl.formatMessage({ id: "auth.signup.name" })}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setErrorMessage(null);
            }}
          />
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={intl.formatMessage({ id: "auth.signup.email" })}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrorMessage(null);
            }}
          />
          <Input
            secureTextEntry
            placeholder={intl.formatMessage({ id: "auth.signup.password" })}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrorMessage(null);
            }}
          />
          <Input
            secureTextEntry
            placeholder={intl.formatMessage({ id: "auth.signup.confirmPassword" })}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrorMessage(null);
            }}
          />
          <Text className="font-normal" style={[styles.hint, { color: mutedColor }]}>
            Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters.
          </Text>
          <Button
            isDisabled={!isFormValid || isSubmitting}
            onPress={() => {
              void handleSignUp();
            }}
          >
            <Button.Label>
              {isSubmitting
                ? intl.formatMessage({ id: "common.status.loading" })
                : intl.formatMessage({ id: "auth.signup.createAccount" })}
            </Button.Label>
          </Button>
        </View>
      </View>
      {
        <>
          {errorMessage && (
            <Text className="font-medium" style={[styles.errorText, { color: dangerColor }]}>
              {errorMessage}
            </Text>
          )}
          {signInLink}
        </>
      }
    </AuthLayout>
  );
}
