import React from "react";
import { ProviderIcon } from "@/features/auth/components/provider-icon";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ProviderInfo } from "@norish/shared/contracts";

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
  const [foregroundColor] = useThemeColor(["foreground"] as const);

  return (
    <>
      {providers.map((provider) => (
        <Button
          key={provider.id}
          isDisabled={isDisabled}
          variant="secondary"
          onPress={() => {
            onPress(provider);
          }}
        >
          <ProviderIcon color={foregroundColor} icon={provider.icon} size={18} />
          <Button.Label style={{ color: foregroundColor }}>
            {activeProviderId === provider.id
              ? intl.formatMessage({ id: "common.status.loading" })
              : intl.formatMessage({ id: "auth.provider.signInWith" }, { provider: provider.name })}
          </Button.Label>
        </Button>
      ))}
    </>
  );
}
