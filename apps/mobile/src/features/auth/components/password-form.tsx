import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { AuthClient } from "@/lib/auth/auth-client";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AuthField } from "@/features/auth/components/auth-field";
import { InlineErrorBlock } from "@/features/auth/components/inline-error";
import { authFailure } from "@/features/auth/utils/auth-failure";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { Button, InputGroup, LinkButton, Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

interface PasswordFormProps {
  authClient: AuthClient;
  showSignUpLink: boolean;
}

/** Email and password, the link to Sign up, and Sign in. */
export function PasswordForm({ authClient, showSignUpLink }: PasswordFormProps) {
  const router = useRouter();
  const intl = useIntl();
  const [mutedColor, accentForegroundColor] = useThemeColor([
    "muted",
    "accent-foreground",
  ] as const);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<InlineErrorState>(null);
  const canSubmit = email.trim() !== "" && password !== "" && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    // On success the Stack.Protected guard leaves Sign in once the session lands.
    const failure = await authFailure(
      authClient.signIn.email({ email: email.trim(), password }),
      "auth.errors.default.description"
    );

    if (failure !== null) setError({ message: intl.formatMessage({ id: failure }) });

    setIsSubmitting(false);
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
            testID="login-email"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
          />
        </AuthField>
        <AuthField
          isInvalid={error !== null}
          label={intl.formatMessage({ id: "auth.emailPassword.password" })}
        >
          <InputGroup.Input
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={intl.formatMessage({ id: "auth.emailPassword.passwordPlaceholder" })}
            returnKeyType="go"
            secureTextEntry={!isPasswordShown}
            testID="login-password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void handleSubmit()}
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
        isDisabled={!canSubmit}
        size="lg"
        testID="login-submit"
        onPress={() => void handleSubmit()}
      >
        {isSubmitting ? (
          <Spinner color={accentForegroundColor} size="sm" />
        ) : (
          <Feather color={accentForegroundColor} name="log-in" size={20} />
        )}
        <Button.Label>{intl.formatMessage({ id: "auth.emailPassword.signIn" })}</Button.Label>
      </Button>
    </View>
  );
}
