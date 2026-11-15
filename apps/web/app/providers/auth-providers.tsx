"use client";

import { ConnectivityProvider } from "@/lib/offline/engine";

import type { User } from "@norish/shared/contracts";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";
import { useSeededSession } from "@norish/shared-react/reader";
import { useSession } from "@norish/shared/lib/auth/client";

import { BaseProviders } from "./base-providers";

/**
 * The signed-in shell's providers. `reader` is who the server verified for this document,
 * answering until the session does; an Offline start-up has none.
 */
export function AuthProviders({
  children,
  deviceKind,
  reader,
}: {
  children: React.ReactNode;
  deviceKind?: DeviceKind;
  reader?: User;
}) {
  const { data, isPending } = useSession();
  const session = useSeededSession({ user: data?.user ?? null, isPending }, reader ?? null);

  return (
    <BaseProviders deviceKind={deviceKind} session={session}>
      <ConnectivityProvider>{children}</ConnectivityProvider>
    </BaseProviders>
  );
}
