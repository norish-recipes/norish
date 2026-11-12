import type { ForegroundContinue } from "@/lib/boot/boot-state";
import React from "react";
import { StatusBadge } from "@/features/auth/components/status-badge";
import { StatusScreen } from "@/features/auth/components/status-screen";
import { useVersionRecheck } from "@/features/auth/hooks/use-version-recheck";
import { hostOf } from "@/features/auth/utils/host-of";
import { MINIMUM_SERVER_VERSION } from "@/features/auth/utils/server-version";
import { useHasActiveSession } from "@/lib/auth/auth-session-sync";
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
  const signedIn = useHasActiveSession();

  // Signed in: back to the app. Signed out: back to what this screen was pushed over,
  // or on to Sign in for an address not saved yet.
  const continueFrom = (next: ForegroundContinue) => {
    if (next.screen === "signed-in-app") {
      if (router.canDismiss()) router.dismissAll();
      else router.replace("/");

      return;
    }

    const wasSaved = getServerAddress() === next.address;

    saveServerAddress(next.address).then(
      () => {
        const dismissed = router.canDismiss();

        if (dismissed) router.dismissAll();
        if (!wasSaved || !dismissed) router.replace("/login");
      },
      (error: unknown) => log.error({ error }, "Could not save the Server Address")
    );
  };

  useVersionRecheck(address, signedIn, continueFrom);

  return (
    <StatusScreen
      badge={<StatusBadge variant="update" />}
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
