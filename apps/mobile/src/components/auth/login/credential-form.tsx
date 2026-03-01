import { Button, Input } from 'heroui-native';
import React from 'react';
import { View } from 'react-native';

import { styles } from '@/styles/login.styles';

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
  return (
    <View style={styles.formSection}>
      <Input
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email"
      />
      <Input
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
      />
      <Button
        isDisabled={!email.trim() || !password || isSubmitting}
        onPress={() => {
          onSubmit();
        }}
      >
        <Button.Label>{isSubmitting ? 'Signing in...' : 'Sign in with password'}</Button.Label>
      </Button>
    </View>
  );
}
