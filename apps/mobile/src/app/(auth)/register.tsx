import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AuthShell } from "@/components/shell/auth-shell";
import { useAuth } from "@/context/auth-context";
import { useAuthProvidersQuery } from "@/hooks/trpc/login/use-auth-providers-query";
import { styles } from "@/styles/register.styles";
import { useRouter } from "expo-router";
import { Button, Card, Input, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export default function RegisterScreen() {
  const router = useRouter();
  const intl = useIntl();
  const { backendBaseUrl, authClient, consumeLogoutFlag } = useAuth();

  const [foregroundColor, mutedColor, accentColor, dangerColor] = useThemeColor([
    "foreground",
    "muted",
    "accent",
    "danger",
  ] as const);

  if (backendBaseUrl === null) {
    return (
      <AuthShell headingPrefix={intl.formatMessage({ id: "auth.signup.title" })}>
        <View style={styles.centered}>
          <Button
            onPress={() => {
              router.replace("/(auth)");
            }}
          >
            <Button.Label>{intl.formatMessage({ id: "auth.errors.backToLogin" })}</Button.Label>
          </Button>
        </View>
      </AuthShell>
    );
  }

  return (
    <RegisterForm
      authClient={authClient}
      consumeLogoutFlag={consumeLogoutFlag}
      foregroundColor={foregroundColor}
      mutedColor={mutedColor}
      accentColor={accentColor}
      dangerColor={dangerColor}
    />
  );
}

function RegisterForm({
  authClient,
  consumeLogoutFlag,
  foregroundColor,
  mutedColor,
  accentColor,
  dangerColor,
}: {
  authClient: ReturnType<typeof import("@/lib/auth-client").getAuthClient> | null;
  consumeLogoutFlag: () => void;
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
    if (!authClient) return;

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

    try {
      const { error } = await authClient.signUp.email({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });

      if (error) {
        setErrorMessage(
          error.message ?? intl.formatMessage({ id: "auth.signup.errors.createFailed" })
        );
        return;
      }

      consumeLogoutFlag();
      // BetterAuth autoSignIn is enabled, so the session is established
      // automatically. Stack.Protected guard handles the redirect to (tabs).
    } catch (error) {
      if (error instanceof Error && error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(intl.formatMessage({ id: "auth.signup.errors.generic" }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [authClient, confirmPassword, consumeLogoutFlag, email, intl, name, password]);

  const signInLink = (
    <Pressable onPress={() => router.replace("/login" as any)} style={styles.linkRow}>
      <Text style={[styles.linkText, { color: mutedColor }]}>
        {intl.formatMessage({ id: "auth.signup.hasAccount" })}{" "}
        <Text style={{ color: accentColor }} className="font-semibold">
          {intl.formatMessage({ id: "auth.signup.signIn" })}
        </Text>
      </Text>
    </Pressable>
  );

  // If we've loaded the providers and registration is not enabled, show a message
  if (hasData && !registrationEnabled) {
    return (
      <AuthShell
        headingPrefix={intl.formatMessage({
          id: "auth.errors.registration_is_currently_disabled.title",
        })}
        footer={signInLink}
      >
        <Card.Title style={{ color: foregroundColor }}>
          {intl.formatMessage({ id: "auth.errors.registration_is_currently_disabled.title" })}
        </Card.Title>
        <Card.Description style={{ color: mutedColor }}>
          {intl.formatMessage({ id: "auth.errors.registration_is_currently_disabled.description" })}
        </Card.Description>
      </AuthShell>
    );
  }

  const passwordsMatch = password === confirmPassword;
  const isFormValid = name.trim() && email.trim() && password && confirmPassword && passwordsMatch;

  return (
    <AuthShell
      headingPrefix={intl.formatMessage({ id: "auth.signup.title" })}
      footer={
        <>
          {errorMessage && (
            <Text style={[styles.errorText, { color: dangerColor }]}>{errorMessage}</Text>
          )}
          {signInLink}
        </>
      }
    >
      <View style={styles.formSection}>
        <Input
          value={name}
          onChangeText={(text) => {
            setName(text);
            setErrorMessage(null);
          }}
          autoCapitalize="words"
          autoCorrect={false}
          placeholder={intl.formatMessage({ id: "auth.signup.name" })}
        />
        <Input
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setErrorMessage(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder={intl.formatMessage({ id: "auth.signup.email" })}
        />
        <Input
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrorMessage(null);
          }}
          secureTextEntry
          placeholder={intl.formatMessage({ id: "auth.signup.password" })}
        />
        <Input
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            setErrorMessage(null);
          }}
          secureTextEntry
          placeholder={intl.formatMessage({ id: "auth.signup.confirmPassword" })}
        />
        <Text style={[styles.hint, { color: mutedColor }]}>
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
    </AuthShell>
  );
}
