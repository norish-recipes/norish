import type { ProviderInfo } from '@norish/shared/contracts';
import { Button, useThemeColor } from 'heroui-native';
import React from 'react';
import { useIntl } from 'react-intl';

import { ProviderIcon } from '@/components/auth';

type OAuthProviderListProps = {
  providers: ProviderInfo[];
  activeProviderId: string | null;
  isDisabled: boolean;
  onPress: (provider: ProviderInfo) => void;
};

export function OAuthProviderList({
  providers,
  activeProviderId,
  isDisabled,
  onPress,
}: OAuthProviderListProps) {
  const intl = useIntl();
  const [foregroundColor] = useThemeColor(['foreground'] as const);

  return (
    <>
      {providers.map((provider) => (
        <Button
          key={provider.id}
          variant="secondary"
          isDisabled={isDisabled}
          onPress={() => {
            onPress(provider);
          }}
        >
          <ProviderIcon icon={provider.icon} size={18} color={foregroundColor} />
          <Button.Label style={{ color: foregroundColor }}>
            {activeProviderId === provider.id
              ? intl.formatMessage({ id: 'common.status.loading' })
              : intl.formatMessage({ id: 'auth.provider.signInWith' }, { provider: provider.name })}
          </Button.Label>
        </Button>
      ))}
    </>
  );
}
