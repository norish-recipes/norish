import { useThemeColor } from 'heroui-native';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { styles } from '@/styles/login.styles';

export function ProviderLoadingState() {
  const [mutedColor] = useThemeColor(['muted'] as const);

  return (
    <View style={styles.centered}>
      <ActivityIndicator />
      <Text style={{ color: mutedColor }}>Loading sign-in methods...</Text>
    </View>
  );
}
