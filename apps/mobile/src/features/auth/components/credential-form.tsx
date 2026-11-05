import React from "react";
import { View } from "react-native";
import { styles } from "@/features/auth/styles/login.styles";
import { Button, Input } from "heroui-native";
import { useIntl } from "react-intl";

type CredentialFormProps = {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export function CredentialForm({
  email,
  setEmail,
  password,
  setPassword,
  isSubmitting,
  onSubmit,
}: CredentialFormProps) {
  const intl = useIntl();

  return (
    <View style={styles.formSection}>
      <Input
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder={intl.formatMessage({ id: "auth.emailPassword.email" })}
        testID="login-email"
        value={email}
        onChangeText={setEmail}
      />
      <Input
        secureTextEntry
        placeholder={intl.formatMessage({ id: "auth.emailPassword.password" })}
        testID="login-password"
        value={password}
        onChangeText={setPassword}
      />
      <Button
        isDisabled={!email.trim() || !password || isSubmitting}
        testID="login-submit"
        onPress={() => {
          onSubmit();
        }}
      >
        <Button.Label>
          {isSubmitting
            ? intl.formatMessage({ id: "common.status.loading" })
            : intl.formatMessage({ id: "auth.emailPassword.signIn" })}
        </Button.Label>
      </Button>
    </View>
  );
}
