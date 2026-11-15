import type { ServerAddressCheck } from "@/lib/network/server-address";
import React, { useEffect, useState } from "react";
import { UpdateServerScreen } from "@/features/auth/screens/update-server-screen";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { SESSION_ROOT_HREF } from "@/features/auth/utils/hrefs";
import { resolveUpdateServerRoute } from "@/lib/boot/version-gate";
import { getServerAddress } from "@/lib/network/server-address";
import { getTooOldServer } from "@/lib/network/too-old-server";
import { Redirect, useLocalSearchParams } from "expo-router";

/** Update your server for an address found too old; opened without that knowledge, it checks first. */
export default function UpdateServerRoute() {
  const { address } = useLocalSearchParams<{ address?: string }>();
  // The hold as it was when opened, so the screen stays while a continuation clears it.
  const [tooOld] = useState(getTooOldServer);
  const [check, setCheck] = useState<ServerAddressCheck | null>(null);
  const next = resolveUpdateServerRoute(address, getServerAddress(), tooOld, check);
  const checking = next.screen === "check" ? next.address : null;

  useEffect(() => {
    if (!checking) return;

    let mounted = true;

    void checkServerAddress(checking).then((answer) => {
      if (mounted) setCheck(answer);
    });

    return () => {
      mounted = false;
    };
  }, [checking]);

  if (next.screen === "leave") return <Redirect href={SESSION_ROOT_HREF} />;
  if (next.screen === "check") return null;

  return <UpdateServerScreen address={next.address} version={next.version} />;
}
