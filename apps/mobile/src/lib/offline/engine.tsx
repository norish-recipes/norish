// The app's offline wiring (ADR-0001): the shared engine over MMKV, the device's connectivity
// hints and the controller. The Warm Set keeps data only; no screen shows images yet.

import React from "react";
import { AppState } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { APP_VERSION } from "@/lib/app-version";
import { getAuthClient } from "@/lib/auth/auth-client";
import { getServerAddress, subscribeServerAddressChange } from "@/lib/network/server-address";
import { addNetworkStateListener } from "expo-network";

import { createOfflineEngine, HEALTH_PROBE_PATH } from "@norish/shared-react/offline";
import {
  ConnectivityProvider as SharedConnectivityProvider,
  OfflineController as SharedOfflineController,
  useConnectivity,
} from "@norish/shared-react/offline/react";
import { useConnectionStatus } from "@norish/shared-react/trpc";
import { getInitialCalendarRange } from "@norish/shared/lib/helpers";

import { createMmkvStorage } from "./mmkv-storage";
import { uploadFiles } from "./upload-files";

/** Marks the app's replays in server logs. */
const OUTBOX_REPLAY_HEADER_VALUE = "mobile-outbox";

export const offlineEngine = createOfflineEngine({
  storage: createMmkvStorage({ mmkv: createMMKV({ id: "norish-offline" }), files: uploadFiles }),
  replayHeaderValue: OUTBOX_REPLAY_HEADER_VALUE,
  probeUrl: () => `${getServerAddress()}${HEALTH_PROBE_PATH}`,
  buster: APP_VERSION,
  calendarRanges: () => [getInitialCalendarRange("mobile")],
});

// Query keys carry no Server Address, so a new one drops every cached answer, signed-out
// reads such as `config.authProviders` included, before the next server's screens read them.
subscribeServerAddressChange(() => offlineEngine.queryClient.clear());

// A network change or a return to the foreground only brings the next probe forward, because
// Wi-Fi is not the backend.
export function subscribeDeviceHints(probeNow: () => void): () => void {
  const network = addNetworkStateListener(() => probeNow());
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") probeNow();
  });

  return () => {
    network.remove();
    appState.remove();
  };
}

const probe = () => offlineEngine.probe();

/** Live or Offline by the readiness probe; the device network and the socket only hint. */
export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const { status: wsStatus } = useConnectionStatus();

  return (
    <SharedConnectivityProvider
      probe={probe}
      subscribeHints={subscribeDeviceHints}
      wsStatus={wsStatus}
    >
      {children}
    </SharedConnectivityProvider>
  );
}

// The auth client is one per server address until a sign-out resets it, and the context rereads
// it then, so this reads the current session without the context.
const getSessionUserId = async () =>
  (await getAuthClient(getServerAddress()).getSession()).data?.user?.id ?? null;

/** The shared offline controller over the app's engine, below auth and tRPC. */
export function OfflineController({
  children,
  sessionUserId,
}: {
  children: React.ReactNode;
  /** The signed-in user, or null while signed out or still unknown. */
  sessionUserId: string | null;
}) {
  const connectivity = useConnectivity();
  const { status: wsStatus } = useConnectionStatus();

  return (
    <SharedOfflineController
      connectivity={connectivity}
      engine={offlineEngine}
      getSessionUserId={getSessionUserId}
      sessionUserId={sessionUserId}
      wsStatus={wsStatus}
    >
      {children}
    </SharedOfflineController>
  );
}
