import { AppState } from "react-native";
import { addNetworkStateListener } from "expo-network";

/**
 * The device's network signal and a return to the foreground only bring the next probe
 * forward; the probe stays the Live/Offline verdict, because Wi-Fi is not the backend.
 */
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
