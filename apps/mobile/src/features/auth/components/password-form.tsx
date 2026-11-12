import type { AuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import type { AuthClient } from "@/lib/auth/auth-client";
import type { ComponentRef } from "react";
import type { TextInput } from "react-native";
import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AuthField } from "@/features/auth/components/auth-field";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { InlineError } from "@/features/auth/components/inline-error";
import { SIGN_IN_DEADLINE_MS } from "@/features/auth/utils/auth-failure";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { InputGroup, useThemeColor } from "heroui-native";
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
  const [mutedColor] = useThemeColor(["muted"] as const);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordShown, setIsPasswordShown] = useState(false);
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
      <AuthField error={error} label={intl.formatMessage({ id: "auth.emailPassword.email" })}>
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
      <AuthField error={error} label={intl.formatMessage({ id: "auth.emailPassword.password" })}>
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
      <InlineError error={error} />

      {showSignUpLink ? (
        // The sentence, sized to its text, is one link, its 20pt line slopped to a 44pt target.
        <Pressable
          accessibilityRole="link"
          className="mt-0.5 self-center"
          hitSlop={{ top: 12, bottom: 12 }}
          onPress={() => router.push("/register")}
        >
          <Text className="text-muted text-center text-[15px] leading-5 font-normal">
            {intl.formatMessage({ id: "auth.emailPassword.noAccount" })}{" "}
            <Text className="text-accent font-semibold">
              {intl.formatMessage({ id: "auth.emailPassword.signUp" })}
            </Text>
          </Text>
        </Pressable>
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
