import React from "react";
import { AuthStatus } from "@/features/auth/components/auth-status";
import { UpdateBadge } from "@/features/auth/components/update-badge";
import { useVersionRecheck } from "@/features/auth/hooks/use-version-recheck";
import { hostOf } from "@/features/auth/utils/host-of";
import { MINIMUM_SERVER_VERSION } from "@/features/auth/utils/server-version";
import { getServerAddress, saveServerAddress } from "@/lib/network/server-address";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-address");

/** The server is older than this app supports: no Retry and no back, only the chip to another server. */
export function UpdateServerScreen({ address, version }: { address: string; version?: string }) {
  const intl = useIntl();
  const router = useRouter();
  const host = hostOf(address);

  // Back to what this screen was pushed over; a Server Address not saved yet goes on to Sign in.
  const continueToSignIn = (checked: string) => {
    const wasSaved = getServerAddress() === checked;

    saveServerAddress(checked).then(
      () => {
        const dismissed = router.canDismiss();

        if (dismissed) router.dismissAll();
        if (!wasSaved || !dismissed) router.replace("/login");
      },
      (error: unknown) => log.error({ error }, "Could not save the Server Address")
    );
  };

  useVersionRecheck(address, continueToSignIn);

  return (
    <AuthStatus
      badge={<UpdateBadge />}
      chipAddress={address}
      description={intl.formatMessage(
        {
          id: version ? "auth.updateServer.description" : "auth.updateServer.descriptionOlder",
        },
        { host, version, minimumVersion: MINIMUM_SERVER_VERSION }
      )}
      descriptionTestID="update-server-description"
      title={intl.formatMessage({ id: "auth.updateServer.title" })}
    />
  );
}
