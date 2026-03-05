import { useThemeColor } from 'heroui-native';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useIntl } from 'react-intl';

import { styles } from '@/styles/login.styles';

export function ProviderLoadingState() {
  const intl = useIntl();
  const [mutedColor] = useThemeColor(['muted'] as const);

  return (
    <View style={styles.centered}>
      <ActivityIndicator />
      <Text style={{ color: mutedColor }}>{intl.formatMessage({ id: 'common.status.loading' })}</Text>
    </View>
  );
}
