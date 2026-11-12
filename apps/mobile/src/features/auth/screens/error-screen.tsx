import React, { use, useState } from "react";
import { StatusBadge } from "@/features/auth/components/status-badge";
import { StatusScreen } from "@/features/auth/components/status-screen";
import { failedProviderName } from "@/features/auth/utils/failed-provider";
import {
  DEFAULT_PROTECTED_ROUTE,
  firstParam,
  sanitizeRedirectTarget,
} from "@/features/auth/utils/redirect";
import { ServerAddressContext } from "@/lib/network/server-address";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useAuthProvidersQuery } from "@norish/shared-react/config";

/** A provider sign-in that failed: names the provider and offers Sign in again, under the server chip. */
export function AuthErrorScreen() {
  const router = useRouter();
  const intl = useIntl();
  const params = useLocalSearchParams<{
    provider?: string | string[];
    redirectTo?: string | string[];
  }>();
  const serverAddress = use(ServerAddressContext);
  const { providers, hasData, error, isPaused } = useAuthProvidersQuery();
  const decided = failedProviderName(
    firstParam(params.provider),
    providers,
    hasData || error !== null || isPaused
  );
  // Latched on the first settled render, so a later refetch can't rename the line.
  const [line, setLine] = useState<{ provider: string | null }>();

  if (line === undefined && decided !== undefined) setLine({ provider: decided });

  const redirectTo = sanitizeRedirectTarget(
    firstParam(params.redirectTo) ?? DEFAULT_PROTECTED_ROUTE
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusScreen
        action={{
          label: intl.formatMessage({ id: "common.errorPage.retry" }),
          testID: "sign-in-failed-retry",
          onPress: () => router.replace({ pathname: "/login", params: { redirectTo } }),
        }}
        badge={<StatusBadge variant="failed" />}
        chipAddress={serverAddress || undefined}
        description={
          // A no-break space holds the line's height until the provider list settles.
          line === undefined
            ? "\u00a0"
            : line.provider
              ? intl.formatMessage(
                  { id: "auth.signInFailed.description" },
                  { provider: line.provider }
                )
              : intl.formatMessage({ id: "auth.signInFailed.descriptionUnnamed" })
        }
        descriptionTestID="sign-in-failed-description"
        title={intl.formatMessage({ id: "auth.signInFailed.title" })}
        titleTestID="sign-in-failed-title"
      />
    </>
  );
}
