import React from "react";
import { View } from "react-native";
import { styles } from "@/styles/login.styles";
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
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder={intl.formatMessage({ id: "auth.emailPassword.email" })}
      />
      <Input
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={intl.formatMessage({ id: "auth.emailPassword.password" })}
      />
      <Button
        isDisabled={!email.trim() || !password || isSubmitting}
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
