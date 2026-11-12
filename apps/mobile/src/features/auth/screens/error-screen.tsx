import React, { use } from "react";
import { StatusBadge } from "@/features/auth/components/status-badge";
import { StatusScreen } from "@/features/auth/components/status-screen";
import { failedProviderName, lastProviderAttempt } from "@/features/auth/utils/failed-provider";
import {
  DEFAULT_PROTECTED_ROUTE,
  firstParam,
  sanitizeRedirectTarget,
} from "@/features/auth/utils/redirect";
import { ServerAddressContext } from "@/lib/network/server-address";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const { providers } = useAuthProvidersQuery();

  const provider = failedProviderName(
    firstParam(params.provider),
    lastProviderAttempt(),
    providers
  );
  const redirectTo = sanitizeRedirectTarget(
    firstParam(params.redirectTo) ?? DEFAULT_PROTECTED_ROUTE
  );

  return (
    <StatusScreen
      action={{
        label: intl.formatMessage({ id: "common.actions.retry" }),
        testID: "sign-in-failed-retry",
        onPress: () => router.replace({ pathname: "/login", params: { redirectTo } }),
      }}
      badge={<StatusBadge variant="failed" />}
      chipAddress={serverAddress || undefined}
      description={
        provider
          ? intl.formatMessage({ id: "auth.signInFailed.description" }, { provider })
          : intl.formatMessage({ id: "auth.signInFailed.descriptionUnnamed" })
      }
      descriptionTestID="sign-in-failed-description"
      title={intl.formatMessage({ id: "auth.signInFailed.title" })}
      titleTestID="sign-in-failed-title"
    />
  );
}
