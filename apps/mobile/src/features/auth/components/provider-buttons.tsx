import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { AuthClient } from "@/lib/auth/auth-client";
import React, { useState } from "react";
import { View } from "react-native";
import { InlineErrorBlock } from "@/features/auth/components/inline-error";
import { ProviderIcon } from "@/features/auth/components/provider-icon";
import { authFailure } from "@/features/auth/utils/auth-failure";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ProviderInfo } from "@norish/shared/contracts";

interface ProviderButtonsProps {
  authClient: AuthClient;
  providers: ProviderInfo[];
  redirectTo: string;
}

/** A "Sign in with" button per OAuth/OIDC provider. */
export function ProviderButtons({ authClient, providers, redirectTo }: ProviderButtonsProps) {
  const intl = useIntl();
  const [foregroundColor] = useThemeColor(["foreground"] as const);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [error, setError] = useState<InlineErrorState>(null);

  const handlePress = async (provider: ProviderInfo) => {
    setError(null);
    setActiveProviderId(provider.id);

    const failure = await authFailure(
      authClient.signIn.social({ provider: provider.id, callbackURL: redirectTo }),
      "auth.errors.default.description"
    );

    if (failure !== null) setError({ message: intl.formatMessage({ id: failure }) });

    setActiveProviderId(null);
  };

  return (
    <View className="gap-2.5">
      <InlineErrorBlock className="gap-2.5" error={error}>
        {providers.map((provider) => (
          <Button
            key={provider.id}
            className="bg-surface rounded-full"
            isDisabled={activeProviderId !== null}
            size="lg"
            variant="outline"
            onPress={() => void handlePress(provider)}
          >
            {activeProviderId === provider.id ? (
              <Spinner color={foregroundColor} size="sm" />
            ) : (
              <ProviderIcon color={foregroundColor} icon={provider.icon} size={18} />
            )}
            <Button.Label className="text-foreground text-base font-medium">
              {intl.formatMessage({ id: "auth.provider.signInWith" }, { provider: provider.name })}
            </Button.Label>
          </Button>
        ))}
      </InlineErrorBlock>
    </View>
  );
}
