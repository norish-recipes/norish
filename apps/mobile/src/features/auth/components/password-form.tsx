import type { AuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import type { AuthClient } from "@/lib/auth/auth-client";
import type { ComponentRef } from "react";
import type { TextInput } from "react-native";
import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AuthField } from "@/features/auth/components/auth-field";
import { InlineErrorBlock } from "@/features/auth/components/inline-error";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { Button, InputGroup, LinkButton, Spinner, useThemeColor } from "heroui-native";
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
  const [mutedColor, accentForegroundColor] = useThemeColor([
    "muted",
    "accent-foreground",
  ] as const);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const passwordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const error = signIn.failure?.method === PASSWORD ? signIn.failure : null;
  const isFilled = email.trim() !== "" && password !== "";

  // On success the Stack.Protected guard leaves Sign in once the session lands.
  const handleSubmit = () => {
    if (!isFilled) return;

    void signIn.attempt(PASSWORD, () => authClient.signIn.email({ email: email.trim(), password }));
  };

  return (
    <View className="gap-3.5">
      <InlineErrorBlock className="gap-3.5" error={error}>
        <AuthField
          isInvalid={error !== null}
          label={intl.formatMessage({ id: "auth.emailPassword.email" })}
        >
          <InputGroup.Input
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={intl.formatMessage({ id: "auth.emailPassword.emailPlaceholder" })}
            returnKeyType="next"
            submitBehavior="submit"
            testID="login-email"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
        </AuthField>
        <AuthField
          isInvalid={error !== null}
          label={intl.formatMessage({ id: "auth.emailPassword.password" })}
        >
          <InputGroup.Input
            ref={passwordInputRef}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={intl.formatMessage({ id: "auth.emailPassword.passwordPlaceholder" })}
            returnKeyType="go"
            secureTextEntry={!isPasswordShown}
            testID="login-password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSubmit}
          />
          {/* heroui-native's own password toggle is a Pressable in the suffix. */}
          <InputGroup.Suffix>
            <Pressable
              accessibilityLabel={intl.formatMessage({
                id: isPasswordShown
                  ? "auth.emailPassword.hidePassword"
                  : "auth.emailPassword.showPassword",
              })}
              accessibilityRole="button"
              className="size-10 items-center justify-center"
              hitSlop={4}
              onPress={() => setIsPasswordShown((shown) => !shown)}
            >
              <Feather color={mutedColor} name={isPasswordShown ? "eye-off" : "eye"} size={20} />
            </Pressable>
          </InputGroup.Suffix>
        </AuthField>
      </InlineErrorBlock>

      {showSignUpLink ? (
        <View className="mt-0.5 flex-row flex-wrap items-center justify-center">
          <Text className="text-muted text-[15px] font-normal">
            {intl.formatMessage({ id: "auth.emailPassword.noAccount" })}{" "}
          </Text>
          <LinkButton onPress={() => router.push("/register")}>
            <LinkButton.Label className="text-accent text-[15px] font-semibold">
              {intl.formatMessage({ id: "auth.emailPassword.signUp" })}
            </LinkButton.Label>
          </LinkButton>
        </View>
      ) : null}

      <Button
        className="rounded-full"
        isDisabled={!isFilled || signIn.running !== null}
        size="lg"
        testID="login-submit"
        onPress={handleSubmit}
      >
        {signIn.running === PASSWORD ? (
          <Spinner color={accentForegroundColor} size="sm" />
        ) : (
          <Feather color={accentForegroundColor} name="log-in" size={20} />
        )}
        <Button.Label>{intl.formatMessage({ id: "auth.emailPassword.signIn" })}</Button.Label>
      </Button>
    </View>
  );
}
