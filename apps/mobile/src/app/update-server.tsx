import React from "react";
import { UpdateServerScreen } from "@/features/auth/screens/update-server-screen";
import { resolveUpdateServerAddress } from "@/lib/boot/boot-state";
import { getServerAddress } from "@/lib/network/server-address";
import { Redirect, useLocalSearchParams } from "expo-router";

/** Update your server for the address it was opened with; with nothing to check, the signed-out entry. */
export default function UpdateServerRoute() {
  const { address, version } = useLocalSearchParams<{ address?: string; version?: string }>();
  const next = resolveUpdateServerAddress(address, getServerAddress());

  if (next.screen === "signed-out-entry") return <Redirect href="/" />;

  return <UpdateServerScreen address={next.address} version={version} />;
}
