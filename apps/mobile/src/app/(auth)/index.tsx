import React, { useState } from "react";
import { ConnectScreen } from "@/features/auth/screens/connect-screen";
import { LoginScreen } from "@/features/auth/screens/login-screen";
import { resolveSignedOutEntry } from "@/lib/boot/boot-state";
import { getServerAddress } from "@/lib/network/server-address";
import { useLocalSearchParams } from "expo-router";

/** Server address, or Sign in when a Server Address is saved; picked once, from the boot gate's read. */
export default function SignedOutEntryRoute() {
  const { change } = useLocalSearchParams<{ change?: string }>();
  const [entry] = useState(() => resolveSignedOutEntry(getServerAddress(), change !== undefined));

  return entry === "sign-in" ? <LoginScreen /> : <ConnectScreen />;
}
