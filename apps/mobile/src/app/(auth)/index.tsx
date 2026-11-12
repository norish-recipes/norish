import React, { useState } from "react";
import { FadeInFill } from "@/features/auth/components/fade-in-fill";
import { ConnectScreen } from "@/features/auth/screens/connect-screen";
import { LoginScreen } from "@/features/auth/screens/login-screen";
import { takeServerChangeAfterSignOut } from "@/hooks/use-change-server-address";
import { takeSessionLeft } from "@/lib/auth/auth-session-sync";
import { fadesInAfterSessionEnd, resolveSignedOutEntry } from "@/lib/boot/signed-out-entry";
import { getServerAddress } from "@/lib/network/server-address";
import { useLocalSearchParams } from "expo-router";

/** Server address, or Sign in when a Server Address is saved; picked once, from the boot gate's read. */
export default function SignedOutEntryRoute() {
  const { change } = useLocalSearchParams<{ change?: string }>();
  // A server change that signed out first opens here, so the fresh stack never shows Sign in;
  // the session's end is taken here too, so only the arrival a session end lands on fades.
  const [arrival] = useState(() => {
    const address = getServerAddress();
    const changeRequested = change !== undefined || takeServerChangeAfterSignOut();

    return {
      entry: resolveSignedOutEntry(address, changeRequested),
      fades: fadesInAfterSessionEnd(takeSessionLeft(), address),
    };
  });

  if (arrival.entry === "sign-in") return <LoginScreen fadeIn={arrival.fades} />;

  return arrival.fades ? (
    <FadeInFill>
      <ConnectScreen />
    </FadeInFill>
  ) : (
    <ConnectScreen />
  );
}
