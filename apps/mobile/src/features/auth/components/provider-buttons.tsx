import type { AuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import type { AuthClient } from "@/lib/auth/auth-client";
import React from "react";
import { View } from "react-native";
import { InlineErrorBlock } from "@/features/auth/components/inline-error";
import { ProviderIcon } from "@/features/auth/components/provider-icon";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ProviderInfo } from "@norish/shared/contracts";

interface ProviderButtonsProps {
  authClient: AuthClient;
  signIn: AuthAttempt;
  providers: ProviderInfo[];
  redirectTo: string;
}

/** A "Sign in with" button per OAuth/OIDC provider, each attempt running under its id. */
export function ProviderButtons({
  authClient,
  signIn,
  providers,
  redirectTo,
}: ProviderButtonsProps) {
  const intl = useIntl();
  const [foregroundColor] = useThemeColor(["foreground"] as const);
  const error = signIn.failureFor(...providers.map((provider) => provider.id));

  return (
    <View className="gap-2.5">
      <InlineErrorBlock className="gap-2.5" error={error}>
        {providers.map((provider) => (
          <Button
            key={provider.id}
            className="bg-surface rounded-full"
            isDisabled={signIn.running !== null}
            size="lg"
            variant="outline"
            onPress={() =>
              void signIn.attempt(provider.id, () =>
                authClient.signIn.social({ provider: provider.id, callbackURL: redirectTo })
              )
            }
          >
            {signIn.running === provider.id ? (
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
