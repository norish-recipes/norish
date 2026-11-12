import React, { useState } from "react";
import { ConnectScreen } from "@/features/auth/screens/connect-screen";
import { LoginScreen } from "@/features/auth/screens/login-screen";
import { takeServerChangeAfterSignOut } from "@/hooks/use-change-server-address";
import { resolveSignedOutEntry } from "@/lib/boot/boot-state";
import { getServerAddress } from "@/lib/network/server-address";
import { useLocalSearchParams } from "expo-router";

/** Server address, or Sign in when a Server Address is saved; picked once, from the boot gate's read. */
export default function SignedOutEntryRoute() {
  const { change } = useLocalSearchParams<{ change?: string }>();
  // A server change that signed out first opens here, so the fresh stack never shows Sign in.
  const [entry] = useState(() =>
    resolveSignedOutEntry(
      getServerAddress(),
      change !== undefined || takeServerChangeAfterSignOut()
    )
  );

  return entry === "sign-in" ? <LoginScreen /> : <ConnectScreen />;
}
